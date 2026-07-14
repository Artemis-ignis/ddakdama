export const ttl = (value: string | undefined, fallbackSeconds: number) => {
  const seconds = Number(value);
  return (
    (Number.isFinite(seconds) && seconds > 0
      ? Math.min(seconds, 2_592_000)
      : fallbackSeconds) * 1_000
  );
};

export const secureShard = () =>
  String(1 + (crypto.getRandomValues(new Uint32Array(1))[0] % 9));

export const normalizePairingCode = (value: string) => {
  const compact = value.normalize("NFKC").replace(/[\s-]+/g, "");
  return /^[1-9]\d{5}$/.test(compact) ? compact : null;
};

export const shardFromOpaqueToken = (value: string) =>
  value.match(/^([1-9])\.[A-Za-z0-9_-]{32,}$/)?.[1] ?? null;

export const shardFromDeviceId = (value: string) =>
  value.match(/^([1-9])_[0-9a-f-]{36}$/i)?.[1] ?? null;
