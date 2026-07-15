import { DurableObject } from "cloudflare:workers";
import { normalizePairingCode } from "./helpers.js";

export {
  normalizePairingCode,
  shardFromDeviceId,
  shardFromOpaqueToken,
} from "./helpers.js";

type Pairing = {
  deviceId: string;
  expiresAt: number;
};

type TimedDevice = {
  deviceId: string;
  expiresAt: number;
};

export type Handoff = {
  id: string;
  deviceId: string;
  payload: unknown;
  createdAt: number;
  expiresAt: number;
  ackedAt: number | null;
  idempotencyKey: string;
};

export type SupportTicket = {
  id: string;
  email: string;
  subject: string;
  message: string;
  createdAt: number;
  expiresAt: number;
  status: "open" | "resolved";
  resolvedAt: number | null;
};

type AttemptWindow = {
  count: number;
  resetAt: number;
};

type StateEnv = Record<string, never>;

const encoder = new TextEncoder();

const hex = (bytes: ArrayBuffer) =>
  [...new Uint8Array(bytes)]
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("");

const hash = async (value: string) =>
  hex(await crypto.subtle.digest("SHA-256", encoder.encode(value)));

const randomInteger = (minimum: number, maximumExclusive: number) => {
  const range = maximumExclusive - minimum;
  const value = crypto.getRandomValues(new Uint32Array(1))[0];
  return minimum + (value % range);
};

const randomSecret = () => {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
};

export class DdakDamaState extends DurableObject<StateEnv> {
  private async allow(
    key: string,
    maximum: number,
    windowMs = 60_000,
  ) {
    const now = Date.now();
    const current = await this.ctx.storage.get<AttemptWindow>(key);
    if (!current || current.resetAt <= now) {
      await this.ctx.storage.put(key, { count: 1, resetAt: now + windowMs });
      return true;
    }
    if (current.count >= maximum) return false;
    await this.ctx.storage.put(key, { ...current, count: current.count + 1 });
    return true;
  }

  async allowPairingStart(clientKey: string, maximum = 10) {
    return this.allow(`rate:start:${await hash(clientKey)}`, maximum);
  }

  async allowPairingAttempt(clientKey: string, maximum = 30) {
    return this.allow(`rate:complete:${await hash(clientKey)}`, maximum);
  }

  async allowSupportSubmission(clientKey: string, maximum = 5) {
    return this.allow(
      `rate:support:${await hash(clientKey)}`,
      maximum,
      60 * 60 * 1_000,
    );
  }

  async startPairing(
    shard: string,
    pairingTtlMs: number,
    deviceTokenTtlMs: number,
  ) {
    if (!/^[1-9]$/.test(shard)) throw new Error("INVALID_SHARD");
    const now = Date.now();
    let code = "";
    for (let attempt = 0; attempt < 30; attempt += 1) {
      const candidate = `${shard}${String(randomInteger(0, 100_000)).padStart(5, "0")}`;
      const key = `pair:${await hash(candidate)}`;
      const existing = await this.ctx.storage.get<Pairing>(key);
      if (!existing || existing.expiresAt <= now) {
        code = candidate;
        break;
      }
    }
    if (!code) throw new Error("PAIRING_CODE_EXHAUSTED");

    const deviceId = `${shard}_${crypto.randomUUID()}`;
    const deviceToken = `${shard}.${randomSecret()}`;
    const expiresAt = now + pairingTtlMs;
    await this.ctx.storage.put({
      [`pair:${await hash(code)}`]: { deviceId, expiresAt } satisfies Pairing,
      [`token:${await hash(deviceToken)}`]: {
        deviceId,
        expiresAt: now + deviceTokenTtlMs,
      } satisfies TimedDevice,
    });
    return { code, deviceId, deviceToken, expiresAt };
  }

  async completePairing(
    code: string,
    clientKey: string,
    grantTtlMs: number,
  ) {
    const normalized = normalizePairingCode(code);
    if (!normalized) return null;
    const clientAllowed = await this.allow(
      `rate:pair-client:${await hash(clientKey)}`,
      30,
    );
    const codeAllowed = await this.allow(
      `rate:pair-code:${await hash(normalized)}`,
      5,
    );
    if (!clientAllowed || !codeAllowed) return null;

    const pairingKey = `pair:${await hash(normalized)}`;
    const pairing = await this.ctx.storage.get<Pairing>(pairingKey);
    if (!pairing || pairing.expiresAt <= Date.now()) {
      if (pairing) await this.ctx.storage.delete(pairingKey);
      return null;
    }

    await this.ctx.storage.delete(pairingKey);
    const shard = normalized[0];
    const connectionGrant = `${shard}.${randomSecret()}`;
    const expiresAt = Date.now() + grantTtlMs;
    await this.ctx.storage.put(`grant:${await hash(connectionGrant)}`, {
      deviceId: pairing.deviceId,
      expiresAt,
    } satisfies TimedDevice);
    return { connectionGrant, expiresAt };
  }

  private async authenticate(prefix: "token" | "grant", value: string) {
    const key = `${prefix}:${await hash(value)}`;
    const item = await this.ctx.storage.get<TimedDevice>(key);
    if (!item) return null;
    if (item.expiresAt <= Date.now()) {
      await this.ctx.storage.delete(key);
      return null;
    }
    return item.deviceId;
  }

  async authenticateDevice(token: string) {
    return this.authenticate("token", token);
  }

  async authenticateGrant(grant: string) {
    return this.authenticate("grant", grant);
  }

  async createHandoff(
    deviceId: string,
    payload: unknown,
    idempotencyKey: string,
    ttlMs: number,
  ) {
    const prefix = `handoff:${deviceId}:`;
    const now = Date.now();
    const entries = await this.ctx.storage.list<Handoff>({ prefix });
    for (const [key, handoff] of entries) {
      if (handoff.expiresAt <= now) {
        await this.ctx.storage.delete(key);
      } else if (handoff.idempotencyKey === idempotencyKey) {
        return handoff;
      }
    }
    const item: Handoff = {
      id: crypto.randomUUID(),
      deviceId,
      payload,
      createdAt: now,
      expiresAt: now + ttlMs,
      ackedAt: null,
      idempotencyKey,
    };
    await this.ctx.storage.put(`${prefix}${item.id}`, item);
    return item;
  }

  async latestHandoff(deviceId: string) {
    const prefix = `handoff:${deviceId}:`;
    const now = Date.now();
    const entries = await this.ctx.storage.list<Handoff>({ prefix });
    const active: Handoff[] = [];
    for (const [key, handoff] of entries) {
      if (handoff.expiresAt <= now) await this.ctx.storage.delete(key);
      else if (!handoff.ackedAt) active.push(handoff);
    }
    return active.sort((left, right) => right.createdAt - left.createdAt)[0] ?? null;
  }

  async ackHandoff(deviceId: string, id: string) {
    const key = `handoff:${deviceId}:${id}`;
    const item = await this.ctx.storage.get<Handoff>(key);
    if (!item || item.deviceId !== deviceId || item.expiresAt <= Date.now()) {
      return false;
    }
    await this.ctx.storage.put(key, { ...item, ackedAt: Date.now() });
    return true;
  }

  async handoffStatus(deviceId: string, id: string) {
    const key = `handoff:${deviceId}:${id}`;
    const item = await this.ctx.storage.get<Handoff>(key);
    if (!item || item.deviceId !== deviceId) return null;
    if (item.expiresAt <= Date.now()) {
      await this.ctx.storage.delete(key);
      return { received: false, expired: true };
    }
    return { received: Boolean(item.ackedAt), expired: false };
  }

  async revokeByToken(kind: "token" | "grant", value: string) {
    const deviceId = await this.authenticate(kind, value);
    if (!deviceId) return false;
    const collections = await Promise.all([
      this.ctx.storage.list<TimedDevice>({ prefix: "token:" }),
      this.ctx.storage.list<TimedDevice>({ prefix: "grant:" }),
      this.ctx.storage.list<Handoff>({ prefix: `handoff:${deviceId}:` }),
    ]);
    const keys: string[] = [];
    for (const entries of collections) {
      for (const [key, item] of entries) {
        if ("deviceId" in item && item.deviceId === deviceId) keys.push(key);
      }
    }
    if (keys.length) await this.ctx.storage.delete(keys);
    return true;
  }

  async createSupportTicket(
    input: Pick<SupportTicket, "email" | "subject" | "message">,
    ttlMs: number,
  ) {
    const now = Date.now();
    const id = `DD-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
    const ticket: SupportTicket = {
      id,
      ...input,
      createdAt: now,
      expiresAt: now + ttlMs,
      status: "open",
      resolvedAt: null,
    };
    await this.ctx.storage.put(`support:${now}:${id}`, ticket);
    return ticket;
  }

  async listSupportTickets(limit = 50) {
    const now = Date.now();
    const entries = await this.ctx.storage.list<SupportTicket>({
      prefix: "support:",
      reverse: true,
      limit: Math.min(Math.max(limit, 1), 100),
    });
    const tickets: SupportTicket[] = [];
    for (const [key, ticket] of entries) {
      if (ticket.expiresAt <= now) {
        await this.ctx.storage.delete(key);
      } else {
        tickets.push(ticket);
      }
    }
    return tickets;
  }

  async resolveSupportTicket(id: string) {
    const entries = await this.ctx.storage.list<SupportTicket>({
      prefix: "support:",
    });
    for (const [key, ticket] of entries) {
      if (ticket.id !== id) continue;
      if (ticket.expiresAt <= Date.now()) {
        await this.ctx.storage.delete(key);
        return null;
      }
      const resolved: SupportTicket = {
        ...ticket,
        status: "resolved",
        resolvedAt: Date.now(),
      };
      await this.ctx.storage.put(key, resolved);
      return resolved;
    }
    return null;
  }
}
