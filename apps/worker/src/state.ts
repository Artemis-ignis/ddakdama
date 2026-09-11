import { DurableObject } from "cloudflare:workers";
import type { CartExecution, CartExecutionItem, CartPlan } from "@ddakdama/core";
import { normalizePairingCode } from "./helpers.js";

export {
  normalizePairingCode,
  shardFromDeviceId,
  shardFromOpaqueToken,
} from "./helpers.js";

type Pairing = {
  deviceId: string;
  expiresAt: number;
  retryNonceHash?: string;
  connectionGrant?: string;
  grantExpiresAt?: number;
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

type StoredPlan = {
  plan: CartPlan;
  expiresAt?: number;
  preflightTokenHash?: string;
  preflightPlanVersion?: number;
  preflightExpiresAt?: number;
  /** Older deployments used a single capability; retain it during migration. */
  accessTokenHash?: string;
  accessTokenHashes?: string[];
  /**
   * A short-lived capability created for the public GPT beta.  It is scoped to
   * one plan and deliberately cannot authenticate a device, an execution, or
   * any Coupang endpoint.
   */
  gptPlanGrantHash?: string;
  gptPlanGrantExpiresAt?: number;
};
type StoredPlanClaim = {
  claimTokenHash: string;
  expiresAt: number;
  claimedDeviceId: string | null;
};
type StoredExecution = {
  execution: CartExecution;
  claimTokenHash: string;
  claimedDeviceId: string | null;
};

type AttemptWindow = {
  count: number;
  resetAt: number;
};

export type AnonymousEvent = {
  id: string;
  name: string;
  sessionId: string;
  planId?: string;
  properties: Record<string, string | number | boolean>;
  createdAt: number;
  expiresAt: number;
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

  async allowGptPlan(clientKey: string, maximum = 12) {
    return this.allow(
      `rate:gpt-plan:${await hash(clientKey)}`,
      maximum,
      60 * 60 * 1_000,
    );
  }

  async allowAnonymousEvent(clientKey: string, maximum = 120) {
    return this.allow(`rate:event:${await hash(clientKey)}`, maximum);
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
    pairingNonce?: string,
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

    const retryNonceHash = pairingNonce ? await hash(pairingNonce) : undefined;
    if (pairing.connectionGrant || pairing.grantExpiresAt) {
      if (
        retryNonceHash &&
        pairing.retryNonceHash === retryNonceHash &&
        pairing.connectionGrant &&
        pairing.grantExpiresAt &&
        pairing.grantExpiresAt > Date.now()
      ) {
        return {
          connectionGrant: pairing.connectionGrant,
          expiresAt: pairing.grantExpiresAt,
        };
      }
      return null;
    }

    const shard = normalized[0];
    const connectionGrant = `${shard}.${randomSecret()}`;
    const expiresAt = Date.now() + grantTtlMs;
    await this.ctx.storage.put({
      [`grant:${await hash(connectionGrant)}`]: {
        deviceId: pairing.deviceId,
        expiresAt,
      } satisfies TimedDevice,
      ...(retryNonceHash
        ? {
            [pairingKey]: {
              ...pairing,
              retryNonceHash,
              connectionGrant,
              grantExpiresAt: expiresAt,
            } satisfies Pairing,
          }
        : {}),
    });
    if (!retryNonceHash) await this.ctx.storage.delete(pairingKey);
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

  async pairingStatus(deviceId: string) {
    const now = Date.now();
    const grants = await this.ctx.storage.list<TimedDevice>({ prefix: "grant:" });
    let grantExpiresAt: number | null = null;
    for (const [key, grant] of grants) {
      if (grant.expiresAt <= now) {
        await this.ctx.storage.delete(key);
        continue;
      }
      if (grant.deviceId === deviceId) {
        grantExpiresAt = Math.max(grantExpiresAt ?? 0, grant.expiresAt);
      }
    }
    return {
      connected: grantExpiresAt !== null,
      grantExpiresAt,
    };
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

  async createPlan(plan: CartPlan, ttlMs = 24 * 60 * 60 * 1_000) {
    const accessToken = randomSecret();
    await this.ctx.storage.put(`plan:${plan.id}`, {
      plan,
      expiresAt: Date.now() + ttlMs,
      accessTokenHashes: [await hash(accessToken)],
    } satisfies StoredPlan);
    return { plan, accessToken };
  }

  async recordAnonymousEvent(
    input: Omit<AnonymousEvent, "id" | "createdAt" | "expiresAt">,
    ttlMs = 24 * 60 * 60 * 1_000,
  ) {
    const createdAt = Date.now();
    const oldEvents = await this.ctx.storage.list<AnonymousEvent>({ prefix: "event:", limit: 100 });
    const expiredKeys = [...oldEvents.entries()]
      .filter(([, event]) => event.expiresAt <= createdAt)
      .map(([key]) => key);
    if (expiredKeys.length) await this.ctx.storage.delete(expiredKeys);
    const event: AnonymousEvent = {
      id: crypto.randomUUID(),
      ...input,
      createdAt,
      expiresAt: createdAt + ttlMs,
    };
    await this.ctx.storage.put(`event:${createdAt}:${event.id}`, event);
    return event;
  }

  async createGptPlan(plan: CartPlan, grantTtlMs: number, planTtlMs = 24 * 60 * 60 * 1_000) {
    const planGrant = randomSecret();
    const expiresAt = Date.now() + grantTtlMs;
    await this.ctx.storage.put(`plan:${plan.id}`, {
      plan,
      expiresAt: Date.now() + planTtlMs,
      gptPlanGrantHash: await hash(planGrant),
      gptPlanGrantExpiresAt: expiresAt,
    } satisfies StoredPlan);
    return { plan, planGrant, expiresAt };
  }

  private async authorizedPlan(record: StoredPlan, accessToken: string) {
    if (record.expiresAt !== undefined && record.expiresAt <= Date.now()) return false;
    const candidate = await hash(accessToken);
    if (record.accessTokenHash === candidate || (record.accessTokenHashes ?? []).includes(candidate)) {
      return true;
    }
    return Boolean(
      record.gptPlanGrantHash === candidate &&
      record.gptPlanGrantExpiresAt &&
      record.gptPlanGrantExpiresAt > Date.now(),
    );
  }

  async readPlan(id: string, accessToken: string) {
    const record = await this.ctx.storage.get<StoredPlan>(`plan:${id}`);
    if (!record || !(await this.authorizedPlan(record, accessToken))) {
      if (record?.expiresAt !== undefined && record.expiresAt <= Date.now()) await this.ctx.storage.delete(`plan:${id}`);
      return null;
    }
    return record.plan;
  }

  async updatePlan(id: string, accessToken: string, expectedVersion: number, next: CartPlan) {
    const record = await this.ctx.storage.get<StoredPlan>(`plan:${id}`);
    if (!record || !(await this.authorizedPlan(record, accessToken))) return { kind: "unauthorized" as const };
    if (record.plan.version !== expectedVersion) return { kind: "conflict" as const, plan: record.plan };
    await this.ctx.storage.put(`plan:${id}`, { ...record, plan: next } satisfies StoredPlan);
    return { kind: "updated" as const, plan: next };
  }

  async issuePlanPreflightToken(id: string, planVersion: number, ttlMs = 5 * 60 * 1_000) {
    const record = await this.ctx.storage.get<StoredPlan>(`plan:${id}`);
    if (!record || record.plan.version !== planVersion) return null;
    if (record.expiresAt !== undefined && record.expiresAt <= Date.now()) {
      await this.ctx.storage.delete(`plan:${id}`);
      return null;
    }
    const preflightToken = randomSecret();
    const expiresAt = Date.now() + ttlMs;
    await this.ctx.storage.put(`plan:${id}`, {
      ...record,
      preflightTokenHash: await hash(preflightToken),
      preflightPlanVersion: planVersion,
      preflightExpiresAt: expiresAt,
    } satisfies StoredPlan);
    return { preflightToken, expiresAt };
  }

  async consumePlanPreflightToken(id: string, preflightToken: string, planVersion: number) {
    const record = await this.ctx.storage.get<StoredPlan>(`plan:${id}`);
    if (!record || record.plan.version !== planVersion || !record.preflightTokenHash || record.preflightPlanVersion !== planVersion || !record.preflightExpiresAt || record.preflightExpiresAt <= Date.now()) return false;
    if (record.preflightTokenHash !== await hash(preflightToken)) return false;
    const withoutPreflight = { ...record };
    delete withoutPreflight.preflightTokenHash;
    delete withoutPreflight.preflightPlanVersion;
    delete withoutPreflight.preflightExpiresAt;
    await this.ctx.storage.put(`plan:${id}`, withoutPreflight satisfies StoredPlan);
    return true;
  }

  async issuePlanClaimToken(id: string, ttlMs: number) {
    const record = await this.ctx.storage.get<StoredPlan>(`plan:${id}`);
    if (!record) return null;
    if (record.expiresAt !== undefined && record.expiresAt <= Date.now()) {
      await this.ctx.storage.delete(`plan:${id}`);
      return null;
    }
    const existingClaim = await this.ctx.storage.get<StoredPlanClaim>(`plan-claim:${id}`);
    if (existingClaim?.claimedDeviceId && existingClaim.expiresAt > Date.now()) return null;
    const claimToken = randomSecret();
    const expiresAt = Date.now() + ttlMs;
    await this.ctx.storage.put(`plan-claim:${id}`, {
      claimTokenHash: await hash(claimToken),
      expiresAt,
      claimedDeviceId: null,
    } satisfies StoredPlanClaim);
    return { claimToken, expiresAt };
  }

  async claimPlan(id: string, claimToken: string, deviceId: string) {
    const [record, claim] = await Promise.all([
      this.ctx.storage.get<StoredPlan>(`plan:${id}`),
      this.ctx.storage.get<StoredPlanClaim>(`plan-claim:${id}`),
    ]);
    if (!record || !claim || claim.expiresAt <= Date.now() || claim.claimedDeviceId || claim.claimTokenHash !== await hash(claimToken)) return null;
    if (record.expiresAt !== undefined && record.expiresAt <= Date.now()) {
      await this.ctx.storage.delete(`plan:${id}`);
      return null;
    }
    const accessToken = randomSecret();
    const accessTokenHashes = [...(record.accessTokenHashes ?? (record.accessTokenHash ? [record.accessTokenHash] : [])), await hash(accessToken)].slice(-4);
    await this.ctx.storage.put({
      [`plan:${id}`]: { plan: record.plan, expiresAt: record.expiresAt, accessTokenHashes } satisfies StoredPlan,
      [`plan-claim:${id}`]: { ...claim, claimedDeviceId: deviceId } satisfies StoredPlanClaim,
    });
    return { plan: record.plan, accessToken };
  }

  async createExecution(execution: CartExecution) {
    const claimToken = randomSecret();
    await this.ctx.storage.put(`execution:${execution.id}`, {
      execution,
      claimTokenHash: await hash(claimToken),
      claimedDeviceId: null,
    } satisfies StoredExecution);
    return { execution, claimToken };
  }

  async issueExecutionClaimToken(id: string) {
    const record = await this.readExecution(id);
    if (!record || record.claimedDeviceId || record.execution.status === "EXPIRED") return null;
    const claimToken = randomSecret();
    await this.ctx.storage.put(`execution:${id}`, {
      ...record,
      claimTokenHash: await hash(claimToken),
    } satisfies StoredExecution);
    return { claimToken, expiresAt: record.execution.expiresAt };
  }

  async readExecution(id: string) {
    const record = await this.ctx.storage.get<StoredExecution>(`execution:${id}`);
    if (!record) return null;
    if (record.execution.expiresAt <= Date.now()) {
      const expired = { ...record.execution, status: "EXPIRED" as const, updatedAt: Date.now() };
      await this.ctx.storage.put(`execution:${id}`, { ...record, execution: expired } satisfies StoredExecution);
      return { ...record, execution: expired };
    }
    return record;
  }

  async claimExecution(id: string, claimToken: string, deviceId: string) {
    const record = await this.readExecution(id);
    if (!record || record.claimTokenHash !== await hash(claimToken)) return null;
    if (record.claimedDeviceId && record.claimedDeviceId !== deviceId) return null;
    if (record.execution.status === "EXPIRED" || record.execution.status === "CANCELLED") return null;
    const execution = {
      ...record.execution,
      status: record.execution.status === "WAITING_FOR_DEVICE" || record.execution.status === "CREATED" ? "READY" as const : record.execution.status,
      updatedAt: Date.now(),
    };
    await this.ctx.storage.put(`execution:${id}`, { ...record, claimedDeviceId: deviceId, execution } satisfies StoredExecution);
    return execution;
  }

  async updateExecutionItem(id: string, deviceId: string, itemId: string, status: CartExecutionItem["status"], message: string | null) {
    const record = await this.readExecution(id);
    if (!record || record.claimedDeviceId !== deviceId || record.execution.status === "EXPIRED") return null;
    const existing = record.execution.items.find((item) => item.id === itemId);
    if (!existing) return null;
    if (["ADDED", "SKIPPED", "FAILED"].includes(existing.status)) {
      return existing.status === status ? record.execution : null;
    }
    const now = Date.now();
    const items = record.execution.items.map((item) => item.id === itemId ? { ...item, status, message, updatedAt: now } : item);
    const done = items.every((item) => ["ADDED", "SKIPPED", "FAILED"].includes(item.status));
    const added = items.filter((item) => item.status === "ADDED").length;
    const nextStatus = done
      ? added === items.length ? "COMPLETED" as const : added > 0 ? "PARTIALLY_COMPLETED" as const : "FAILED" as const
      : ["OPTION_REQUIRED", "PRICE_CHANGED"].includes(status) ? "PAUSED_FOR_USER" as const
      : "RUNNING" as const;
    const execution = { ...record.execution, status: nextStatus, items, updatedAt: now };
    await this.ctx.storage.put(`execution:${id}`, { ...record, execution } satisfies StoredExecution);
    return execution;
  }

  async revokeByToken(kind: "token" | "grant", value: string) {
    const deviceId = await this.authenticate(kind, value);
    if (!deviceId) return false;
    const collections = await Promise.all([
      this.ctx.storage.list<TimedDevice>({ prefix: "token:" }),
      this.ctx.storage.list<TimedDevice>({ prefix: "grant:" }),
      this.ctx.storage.list<Pairing>({ prefix: "pair:" }),
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
