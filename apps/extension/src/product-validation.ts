import { parseExplicitUnitsPerPackage, productIdentityTokens } from "@ddakdama/core";

export type ProductExpectation = {
  productUrl: string;
  productId: string;
  vendorItemId: string | null;
  itemId: string | null;
  expectedBrand: string | null;
  expectedProductName: string;
  expectedUnitsPerPackage: number;
  expectedUnitSize: string | null;
  expectedStrength: string | null;
  expectedPackageContent: string | null;
};

export type ProductDetail = {
  productId: string | null;
  vendorItemId: string | null;
  itemId: string | null;
  title: string;
  price: number | null;
  unitsPerPackage: number;
  inStock: boolean;
  optionRequired: boolean;
  securityRequired: boolean;
  loginRequired: boolean;
};

export type ProductMismatchReason =
  | "PRODUCT_URL"
  | "PRODUCT_ID"
  | "VENDOR_ITEM_ID"
  | "ITEM_ID"
  | "TITLE"
  | "UNITS_PER_PACKAGE"
  | "UNIT_SIZE"
  | "STRENGTH"
  | "PACKAGE_CONTENT";

const normalize = (value: string) => value.toLowerCase().replace(/[^0-9a-z가-힣]/gu, "");

const marketingTokens = new Set([
  "광고",
  "공식",
  "기획",
  "대용량",
  "더블기획",
  "로켓배송",
  "로켓프레시",
  "무료배송",
  "본사",
  "사은품",
  "상품",
  "선택",
  "세트",
  "정품",
  "증정",
  "출고",
  "추가",
]);

const meaningfulIdentityTokens = (value: string) =>
  productIdentityTokens(value).filter((token) =>
    !marketingTokens.has(token)
    && !/^\d+(?:\.\d+)?(?:ml|l|g|kg|mg|mcg|ug|iu|개|개입|병|통|팩|세트|입|정|캡슐|포|매|스틱)$/iu.test(token)
    && !/^(?:x|×)\d+$/iu.test(token)
    && !/^\d+\+\d+$/u.test(token));

const titleIdentityMatches = (title: string, brand: string | null, productName: string) => {
  const normalizedTitle = normalize(title);
  const brandToken = brand ? normalize(brand) : "";
  if (brandToken && !normalizedTitle.includes(brandToken)) return false;

  const tokens = meaningfulIdentityTokens(productName);
  if (!tokens.length) return false;
  const matched = tokens.filter((token) => normalizedTitle.includes(token)).length;
  if (tokens.length === 1) return matched === 1;
  if (tokens.length === 2) return matched === 2;
  return matched >= Math.max(2, Math.ceil(tokens.length / 2));
};

type ComparableSpec = { kind: string; value: number };

const canonicalSpecText = (value: string) => value
  .toLowerCase()
  .replace(/킬로그램/gu, "kg")
  .replace(/밀리그램/gu, "mg")
  .replace(/밀리리터/gu, "ml")
  .replace(/마이크로그램/gu, "mcg")
  .replace(/리터/gu, "l")
  .replace(/그램/gu, "g")
  .replace(/[μµ]/gu, "u");

const comparableSpecs = (value: string): ComparableSpec[] => {
  const text = canonicalSpecText(value);
  const matches = text.matchAll(/(\d+(?:\.\d+)?)\s*(mcg|mg|ml|kg|iu|ug|l|g|정|캡슐|포|매|스틱|병입|개입)/giu);
  return [...matches].flatMap((match) => {
    const rawValue = Number(match[1]);
    const unit = match[2].toLowerCase();
    if (!Number.isFinite(rawValue)) return [];
    if (unit === "l") return [{ kind: "volume", value: rawValue * 1000 }];
    if (unit === "ml") return [{ kind: "volume", value: rawValue }];
    if (unit === "kg") return [{ kind: "mass", value: rawValue * 1000 }];
    if (unit === "g") return [{ kind: "mass", value: rawValue }];
    if (unit === "mg") return [{ kind: "strength-mg", value: rawValue }];
    if (unit === "mcg" || unit === "ug") return [{ kind: "strength-mg", value: rawValue / 1000 }];
    if (unit === "iu") return [{ kind: "strength-iu", value: rawValue }];
    return [{ kind: `count-${unit}`, value: rawValue }];
  });
};

/**
 * 상세 제목에 같은 종류의 규격이 없으면 "알 수 없음"으로 허용합니다.
 * 상세 제목에 규격이 명시된 경우에는 요청 규격과 동치여야 합니다.
 */
const specMatchesOrIsUnknown = (expected: string | null, title: string) => {
  if (!expected) return true;
  const expectedSpec = comparableSpecs(expected)[0];
  if (!expectedSpec) return normalize(title).includes(normalize(expected));
  const actualSpecs = comparableSpecs(title).filter((spec) => spec.kind === expectedSpec.kind);
  if (!actualSpecs.length) return true;
  return actualSpecs.some((spec) => Math.abs(spec.value - expectedSpec.value) < 0.0001);
};

export function productMismatchReasons(job: ProductExpectation, detail: ProductDetail): ProductMismatchReason[] {
  const reasons: ProductMismatchReason[] = [];
  if (detail.productId !== job.productId) reasons.push("PRODUCT_ID");

  const exactVendor = Boolean(job.vendorItemId && detail.vendorItemId && job.vendorItemId === detail.vendorItemId);
  const exactItem = Boolean(job.itemId && detail.itemId && job.itemId === detail.itemId);
  if (job.vendorItemId && detail.vendorItemId && !exactVendor) reasons.push("VENDOR_ITEM_ID");
  if (job.itemId && detail.itemId && !exactItem && !exactVendor) reasons.push("ITEM_ID");

  // vendorItemId는 쿠팡의 실제 판매 옵션 식별자입니다. 이 값이 같으면
  // 검색 제목과 상세 제목의 판촉 문구 차이로 같은 SKU를 거부하지 않습니다.
  if (!exactVendor && !exactItem && !titleIdentityMatches(detail.title, job.expectedBrand, job.expectedProductName)) {
    reasons.push("TITLE");
  }

  const explicitUnits = parseExplicitUnitsPerPackage(detail.title);
  if (explicitUnits !== null && explicitUnits !== job.expectedUnitsPerPackage) reasons.push("UNITS_PER_PACKAGE");
  if (!specMatchesOrIsUnknown(job.expectedUnitSize, detail.title)) reasons.push("UNIT_SIZE");
  if (!specMatchesOrIsUnknown(job.expectedStrength, detail.title)) reasons.push("STRENGTH");
  if (!specMatchesOrIsUnknown(job.expectedPackageContent, detail.title)) reasons.push("PACKAGE_CONTENT");
  return reasons;
}

export function productMatches(job: ProductExpectation, detail: ProductDetail) {
  return productMismatchReasons(job, detail).length === 0;
}

export function validateProductUrl(job: ProductExpectation) {
  try {
    const url = new URL(job.productUrl);
    return url.protocol === "https:"
      && url.hostname === "www.coupang.com"
      && (url.pathname === `/vp/products/${job.productId}` || url.pathname === `/vp/products/${job.productId}/`);
  } catch {
    return false;
  }
}

export function detailStatus(job: ProductExpectation, detail: ProductDetail) {
  if (detail.securityRequired) return "SECURITY_CHECK_REQUIRED";
  if (detail.loginRequired) return "LOGIN_REQUIRED";
  if (!productMatches(job, detail)) return "PRODUCT_MISMATCH";
  if (!detail.price) return "PRICE_UNVERIFIED";
  if (detail.optionRequired) return "OPTION_REQUIRED";
  if (!detail.inStock) return "OUT_OF_STOCK";
  return "READY";
}
