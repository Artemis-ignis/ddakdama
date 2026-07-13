import { createHash, randomBytes, randomInt, randomUUID } from "node:crypto";

type Pairing = {
  code: string;
  deviceId: string;
  expiresAt: number;
  used: boolean;
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
let pairingAttempts: number[] = [];

const hash = (value: string) => createHash("sha256").update(value).digest("hex");
const secret = () => randomBytes(32).toString("base64url");

function purge() {
  const now = Date.now();
  for (const [code, item] of pairings) {
    if (item.expiresAt < now || item.used) pairings.delete(code);
  }
  for (const [key, item] of tokens) {
    if (item.expiresAt < now) tokens.delete(key);
  }
  for (const [key, item] of grants) {
    if (item.expiresAt < now) grants.delete(key);
  }
  for (const [id, item] of handoffs) {
    if (item.expiresAt < now) handoffs.delete(id);
  }
  pairingAttempts = pairingAttempts.filter((attemptedAt) => now - attemptedAt < 60_000);
}

export function startPairing(ttlMs = 600_000, tokenTtlMs = 30 * 24 * 60 * 60_000) {
  purge();
  const deviceId = randomUUID();
  let code = "";
  do code = String(randomInt(100_000, 1_000_000));
  while (pairings.has(code));
  const deviceToken = secret();
  const expiresAt = Date.now() + ttlMs;
  pairings.set(code, { code, deviceId, expiresAt, used: false });
  tokens.set(hash(deviceToken), { deviceId, expiresAt: Date.now() + tokenTtlMs });
  return { code, deviceId, deviceToken, expiresAt };
}

export function completePairing(code: string, grantTtlMs = 24 * 60 * 60_000) {
  purge();
  if (pairingAttempts.length >= 30) return null;
  pairingAttempts.push(Date.now());
  const pairing = pairings.get(code);
  if (!pairing || pairing.used || pairing.expiresAt < Date.now()) return null;
  pairing.used = true;
  const connectionGrant = secret();
  const expiresAt = Date.now() + grantTtlMs;
  grants.set(hash(connectionGrant), { deviceId: pairing.deviceId, expiresAt });
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

export function revokeDeviceToken(token: string) {
  return tokens.delete(hash(token));
}

export function createHandoff(
  deviceId: string,
  payload: unknown,
  idempotencyKey: string,
  ttlMs = 900_000,
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
  return true;
}

export function handoffStatus(deviceId: string, id: string) {
  purge();
  const item = handoffs.get(id);
  return item && item.deviceId === deviceId
    ? { id: item.id, received: Boolean(item.ackedAt), expired: false }
    : null;
}

export function resetStore() {
  pairings.clear();
  tokens.clear();
  grants.clear();
  handoffs.clear();
  pairingAttempts = [];
}
