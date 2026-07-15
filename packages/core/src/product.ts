const normalize = (value: string) => value.toLowerCase().replace(/[^0-9a-z가-힣]/gu, "");

/**
 * 쿠팡 제목에서 판매 묶음에 포함된 실물 개수를 읽습니다.
 * 정·캡슐 같은 제품 내부 규격은 묶음 수량으로 취급하지 않습니다.
 */
export function parseExplicitUnitsPerPackage(title: string): number | null {
  const normalized = title
    .replace(/[（]/gu, "(")
    .replace(/[）]/gu, ")")
    .replace(/\s+/gu, " ")
    .trim();
  const withoutGiftParentheses = normalized.replace(/\([^)]*(?:증정|사은품|샘플|여행용|미니)[^)]*\)/gu, " ").trim();
  const withoutGiftSegments = withoutGiftParentheses.replace(/\+\s*[^,]*(?:증정|사은품|샘플|여행용|미니)[^,]*(?:,|$)/gu, " ").trim();
  const patterns = [
    /(?:^|[\s,(/])(?:x|×)\s*(\d{1,2})(?=\s|[),/]|$)/iu,
    /(?:^|[\s,(/])(\d{1,2})\s*(?:개입|개|병|통|세트|입)(?=\s|[),/]|$)/u,
    /(?:^|[\s,(/])(\d{1,2})\s*팩(?=\s|[),/]|$)/u,
  ];
  for (const pattern of patterns) {
    const matches = [...withoutGiftSegments.matchAll(new RegExp(pattern.source, pattern.flags.includes("g") ? pattern.flags : `${pattern.flags}g`))];
    const value = Number(matches.at(-1)?.[1] ?? 0);
    if (Number.isInteger(value) && value >= 1 && value <= 20) return value;
  }
  const onePlusOne = withoutGiftSegments.match(/(?:^|\s)1\s*\+\s*1(?:\s|$)/u);
  return onePlusOne ? 2 : null;
}

/**
 * 검색 결과에서는 묶음 표기가 없으면 단품으로 계산합니다. 상세페이지
 * 검증에서는 `parseExplicitUnitsPerPackage`를 사용해 "표기 없음"과 실제
 * 단품 표기를 구분해야 합니다.
 */
export function parseUnitsPerPackage(title: string): number {
  return parseExplicitUnitsPerPackage(title) ?? 1;
}

export function productIdentityTokens(value: string): string[] {
  return [...new Set(value.split(/\s+/u).map(normalize).filter(Boolean))];
}

export function titleContainsProductIdentity(title: string, brand: string | null, productName: string): boolean {
  const normalizedTitle = normalize(title);
  const brandToken = brand ? normalize(brand) : "";
  const nameTokens = productIdentityTokens(productName);
  return (!brandToken || normalizedTitle.includes(brandToken)) && nameTokens.length > 0 && nameTokens.every((token) => normalizedTitle.includes(token));
}
