import { createHash, randomBytes, randomInt, randomUUID } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

type Pairing = {
  deviceId: string;
  expiresAt: number;
  used: boolean;
  retryNonceHash?: string;
  connectionGrant?: string;
  grantExpiresAt?: number;
};
type TimedDevice = { deviceId: string; expiresAt: number };
type Handoff = {
  id: string;
  deviceId: string;
  payload: unknown;
  createdAt: number;
  expiresAt: number;
  ackedAt: number | null;
  idempotencyKey: string;
};

const pairings = new Map<string, Pairing>();
const tokens = new Map<string, TimedDevice>();
const grants = new Map<string, TimedDevice>();
const handoffs = new Map<string, Handoff>();
const pairingAttemptsByClient = new Map<string, number[]>();
const pairingAttemptsByCode = new Map<string, number[]>();
const storeFile = process.env.DDAKDAMA_STORE_FILE?.trim() ? resolve(process.cwd(), process.env.DDAKDAMA_STORE_FILE.trim()) : null;

const hash = (value: string) => createHash("sha256").update(value).digest("hex");
const secret = () => randomBytes(32).toString("base64url");
const configuredTtl = (name: string, fallbackMs: number) => {
  const seconds = Number(process.env[name]);
  return Number.isFinite(seconds) && seconds > 0 ? Math.min(seconds, 2_592_000) * 1_000 : fallbackMs;
};

function persist() {
  if (!storeFile) return;
  mkdirSync(dirname(storeFile), { recursive: true });
  writeFileSync(storeFile, JSON.stringify({ pairings: [...pairings], tokens: [...tokens], grants: [...grants], handoffs: [...handoffs] }), { encoding: "utf8", mode: 0o600 });
}

function restore() {
  if (!storeFile) return;
  try {
    const value = JSON.parse(readFileSync(storeFile, "utf8")) as Record<string, unknown>;
    for (const [target, source] of [[pairings, value.pairings], [tokens, value.tokens], [grants, value.grants], [handoffs, value.handoffs]] as const) {
      if (!Array.isArray(source)) continue;
      for (const entry of source) if (Array.isArray(entry) && typeof entry[0] === "string" && entry[1] && typeof entry[1] === "object") target.set(entry[0], entry[1] as never);
    }
  } catch {
    // 첫 실행 또는 손상된 로컬 상태는 빈 저장소로 안전하게 시작합니다.
  }
}

restore();

function purge() {
  const now = Date.now();
  let changed = false;
  for (const [code, item] of pairings) {
    if (item.expiresAt < now) { pairings.delete(code); changed = true; }
  }
  for (const [key, item] of tokens) {
    if (item.expiresAt < now) { tokens.delete(key); changed = true; }
  }
  for (const [key, item] of grants) {
    if (item.expiresAt < now) { grants.delete(key); changed = true; }
  }
  for (const [id, item] of handoffs) {
    if (item.expiresAt < now) { handoffs.delete(id); changed = true; }
  }
  for (const attempts of [pairingAttemptsByClient, pairingAttemptsByCode]) {
    for (const [key, values] of attempts) {
      const recent = values.filter((attemptedAt) => now - attemptedAt < 60_000);
      if (recent.length) attempts.set(key, recent);
      else attempts.delete(key);
    }
  }
  if (changed) persist();
}

function recordPairingAttempt(code: string, clientKey: string) {
  const normalizedClient = clientKey.trim().slice(0, 200) || "unknown";
  const clientAttempts = pairingAttemptsByClient.get(normalizedClient) ?? [];
  const codeAttempts = pairingAttemptsByCode.get(code) ?? [];
  if (clientAttempts.length >= 30 || codeAttempts.length >= 5) return false;
  const now = Date.now();
  pairingAttemptsByClient.set(normalizedClient, [...clientAttempts, now]);
  pairingAttemptsByCode.set(code, [...codeAttempts, now]);
  return true;
}

export function normalizePairingCode(value: string) {
  const compact = value.normalize("NFKC").replace(/[\s-]+/g, "");
  return /^\d{6}$/.test(compact) ? compact : null;
}

export function startPairing(ttlMs = configuredTtl("PAIRING_TTL_SECONDS", 600_000), tokenTtlMs = 30 * 24 * 60 * 60_000) {
  purge();
  const deviceId = randomUUID();
  let code = "";
  do code = String(randomInt(100_000, 1_000_000));
  while (pairings.has(hash(code)));
  const deviceToken = secret();
  const expiresAt = Date.now() + ttlMs;
  pairings.set(hash(code), { deviceId, expiresAt, used: false });
  tokens.set(hash(deviceToken), { deviceId, expiresAt: Date.now() + tokenTtlMs });
  persist();
  return { code, deviceId, deviceToken, expiresAt };
}

export function completePairing(
  code: string,
  clientKey = "unknown",
  pairingNonce?: string,
  grantTtlMs = configuredTtl("CONNECTION_GRANT_TTL_SECONDS", 24 * 60 * 60_000),
) {
  purge();
  const normalizedCode = normalizePairingCode(code);
  if (!normalizedCode) {
    recordPairingAttempt(`invalid:${hash(code)}`, clientKey);
    return null;
  }
  if (!recordPairingAttempt(normalizedCode, clientKey)) return null;
  const pairing = pairings.get(hash(normalizedCode));
  if (!pairing || pairing.expiresAt < Date.now()) return null;
  const retryNonceHash = pairingNonce ? hash(pairingNonce) : undefined;
  if (pairing.used) {
    return retryNonceHash &&
      pairing.retryNonceHash === retryNonceHash &&
      pairing.connectionGrant &&
      pairing.grantExpiresAt &&
      pairing.grantExpiresAt > Date.now()
      ? {
          connectionGrant: pairing.connectionGrant,
          expiresAt: pairing.grantExpiresAt,
        }
      : null;
  }
  pairing.used = true;
  const connectionGrant = secret();
  const expiresAt = Date.now() + grantTtlMs;
  if (retryNonceHash) {
    pairing.retryNonceHash = retryNonceHash;
    pairing.connectionGrant = connectionGrant;
    pairing.grantExpiresAt = expiresAt;
  }
  grants.set(hash(connectionGrant), { deviceId: pairing.deviceId, expiresAt });
  persist();
  return { connectionGrant, expiresAt };
}

export function authenticateDevice(token: string) {
  purge();
  return tokens.get(hash(token))?.deviceId ?? null;
}

export function authenticateGrant(grant: string) {
  purge();
  return grants.get(hash(grant))?.deviceId ?? null;
}

export function pairingStatus(deviceId: string) {
  purge();
  const grantExpiresAt = [...grants.values()]
    .filter((grant) => grant.deviceId === deviceId && grant.expiresAt > Date.now())
    .reduce<number | null>(
      (latest, grant) => Math.max(latest ?? 0, grant.expiresAt),
      null,
    );
  return {
    connected: grantExpiresAt !== null,
    grantExpiresAt,
  };
}

export function revokeDeviceToken(token: string) {
  purge();
  const deviceId = tokens.get(hash(token))?.deviceId;
  return deviceId ? revokeDevice(deviceId) : false;
}

export function revokeConnectionGrant(grant: string) {
  purge();
  const deviceId = grants.get(hash(grant))?.deviceId;
  return deviceId ? revokeDevice(deviceId) : false;
}

function revokeDevice(deviceId: string) {
  let revoked = false;
  for (const [key, item] of tokens) {
    if (item.deviceId === deviceId) {
      tokens.delete(key);
      revoked = true;
    }
  }
  for (const [key, item] of grants) {
    if (item.deviceId === deviceId) {
      grants.delete(key);
      revoked = true;
    }
  }
  for (const [code, item] of pairings) {
    if (item.deviceId === deviceId) pairings.delete(code);
  }
  for (const [id, item] of handoffs) {
    if (item.deviceId === deviceId) handoffs.delete(id);
  }
  if (revoked) persist();
  return revoked;
}

export function createHandoff(
  deviceId: string,
  payload: unknown,
  idempotencyKey: string,
  ttlMs = configuredTtl("HANDOFF_TTL_SECONDS", 900_000),
) {
  purge();
  const existing = [...handoffs.values()].find(
    (item) =>
      item.deviceId === deviceId &&
      item.idempotencyKey === idempotencyKey &&
      item.expiresAt > Date.now(),
  );
  if (existing) return existing;
  const item: Handoff = {
    id: randomUUID(),
    deviceId,
    payload,
    createdAt: Date.now(),
    expiresAt: Date.now() + ttlMs,
    ackedAt: null,
    idempotencyKey,
  };
  handoffs.set(item.id, item);
  persist();
  return item;
}

export function latestHandoff(deviceId: string) {
  purge();
  return (
    [...handoffs.values()]
      .filter((item) => item.deviceId === deviceId && !item.ackedAt)
      .sort((a, b) => b.createdAt - a.createdAt)[0] ?? null
  );
}

export function ackHandoff(deviceId: string, id: string) {
  purge();
  const item = handoffs.get(id);
  if (!item || item.deviceId !== deviceId) return false;
  item.ackedAt = Date.now();
  persist();
  return true;
}

export function handoffStatus(deviceId: string, id: string) {
  purge();
  const item = handoffs.get(id);
  return item && item.deviceId === deviceId
    ? { received: Boolean(item.ackedAt), expired: false }
    : null;
}

export function resetStore() {
  pairings.clear();
  tokens.clear();
  grants.clear();
  handoffs.clear();
  pairingAttemptsByClient.clear();
  pairingAttemptsByCode.clear();
  persist();
}
