const MAX_REASONABLE_WON = 1_000_000_000;

const saneWon = (value: string) => {
  const normalized = value.replace(/,/g, "").trim();
  if (!/^\d+$/u.test(normalized)) return null;
  const parsed = Number(normalized);
  return Number.isSafeInteger(parsed) && parsed > 0 && parsed <= MAX_REASONABLE_WON
    ? parsed
    : null;
};

/**
 * 쿠팡 DOM 문자열에서 하나의 금액만 읽습니다.
 * 여러 금액이 섞인 부모 노드의 숫자를 이어 붙이지 않는 것이 핵심입니다.
 */
export const parseWon = (text: string, allowBareNumber = false) => {
  const matches = [...text.matchAll(/(?:₩\s*)?(\d{1,3}(?:,\d{3})+|\d+)\s*원/gu)];
  for (const match of matches) {
    const parsed = saneWon(match[1]);
    if (parsed !== null) return parsed;
  }
  return allowBareNumber ? saneWon(text) : null;
};

export const isPlausibleCartLineTotal = (
  cartLineTotal: number | null | undefined,
  verifiedUnitPrice: number | null | undefined,
  quantity: number,
) => {
  if (!Number.isSafeInteger(cartLineTotal) || Number(cartLineTotal) <= 0) return false;
  if (!Number.isSafeInteger(verifiedUnitPrice) || Number(verifiedUnitPrice) <= 0 || quantity <= 0) return false;
  const expected = Number(verifiedUnitPrice) * quantity;
  const maximum = Math.max(expected * 3, expected + 100_000);
  return Number(cartLineTotal) <= maximum;
};
