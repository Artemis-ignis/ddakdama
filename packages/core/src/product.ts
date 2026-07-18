const normalize = (value: string) => value.toLowerCase().replace(/[^0-9a-z\uac00-\ud7a3]/gu, "");

const physicalPackageUnit = "\\uac1c|\\ubcd1|\\uce94|\\ubd09|\\ud1b5|\\ud329";
const explicitCountPatterns = [
  new RegExp(`(?:^|[\\s,(/])(?:x|\\u00d7)\\s*(\\d{1,3})(?=\\s|[),/]|$)`, "iu"),
  new RegExp(`(?:^|[\\s,(/])(\\d{1,3})\\s*(?:\\uac1c\\uc785|${physicalPackageUnit}|\\ubb36\\uc74c|\\uc138\\ud2b8|\\ubc15\\uc2a4)(?=\\s|[),/]|$)`, "iu"),
];

/**
 * Reads the number of separately purchasable physical units represented by a
 * Coupang listing. Tablet counts are intentionally excluded: "240\uC815" is
 * the content of one supplement bottle, not 240 cart items.
 */
export function parseExplicitUnitsPerPackage(title: string): number | null {
  const normalized = title.replace(/[\uff08]/gu, "(").replace(/[\uff09]/gu, ")").replace(/\s+/gu, " ").trim();
  const withoutGiftText = normalized
    .replace(/\([^)]*(?:\uc99d\uc815|\uc0ac\uc740\ud488|\ud504\ub9ac\ubbf8\uc5c4)[^)]*\)/gu, " ")
    .replace(/\+\s*[^,]*(?:\uc99d\uc815|\uc0ac\uc740\ud488|\ud504\ub9ac\ubbf8\uc5c4)[^,]*(?:,|$)/gu, " ")
    .trim();

  for (const pattern of explicitCountPatterns) {
    const matches = [...withoutGiftText.matchAll(new RegExp(pattern.source, `${pattern.flags}g`))];
    const value = Number(matches.at(-1)?.[1] ?? 0);
    if (Number.isInteger(value) && value >= 1 && value <= 500) return value;
  }

  return /(?:^|\s)1\s*\+\s*1(?:\s|$)/u.test(withoutGiftText) ? 2 : null;
}

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
