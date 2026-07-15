import { describe, expect, it } from "vitest";
import {
  detailStatus,
  productMatches,
  productMismatchReasons,
  validateProductUrl,
} from "../src/product-validation";

const job = {
  productUrl: "https://www.coupang.com/vp/products/123?itemId=11&vendorItemId=22",
  productId: "123",
  vendorItemId: "22",
  itemId: "11",
  expectedBrand: "스킨1004",
  expectedProductName: "스킨1004 히알루 시카 워터핏 선 세럼",
  expectedUnitsPerPackage: 2,
  expectedUnitSize: "50ml",
  expectedStrength: null,
  expectedPackageContent: null,
};

const detail = {
  productId: "123",
  vendorItemId: "22",
  itemId: "11",
  title: "스킨1004 히알루-시카 워터핏 선 세럼 50mL, 2개",
  price: 21800,
  unitsPerPackage: 2,
  inStock: true,
  optionRequired: false,
  securityRequired: false,
  loginRequired: false,
};

describe("쿠팡 상세페이지 preflight", () => {
  it("상품 URL과 판매 SKU가 일치하면 통과한다", () => {
    expect(validateProductUrl(job)).toBe(true);
    expect(productMatches(job, detail)).toBe(true);
    expect(detailStatus(job, detail)).toBe("READY");
  });

  it("vendorItem이 실제로 다르면 차단한다", () => {
    const changed = { ...detail, vendorItemId: "99", itemId: "98" };
    expect(productMatches(job, changed)).toBe(false);
    expect(productMismatchReasons(job, changed)).toEqual(expect.arrayContaining(["VENDOR_ITEM_ID", "ITEM_ID"]));
  });

  it("같은 vendorItem이면 상세 URL에서 itemId가 생략되거나 달라도 통과한다", () => {
    expect(detailStatus(job, { ...detail, itemId: null })).toBe("READY");
    expect(detailStatus(job, { ...detail, itemId: "redirected-item" })).toBe("READY");
  });

  it("검색 제목보다 상세 제목이 짧고 묶음 표기가 생략돼도 같은 SKU면 통과한다", () => {
    const manualJob = {
      ...job,
      expectedBrand: null,
      expectedProductName: "[로켓프레시] 하림 닭강정 에어프라이어 1kg, 2개",
      expectedUnitsPerPackage: 2,
      expectedUnitSize: "1kg",
    };
    const live = {
      ...detail,
      title: "하림 닭강정 1kg",
      itemId: null,
      unitsPerPackage: 1,
    };
    expect(productMismatchReasons(manualJob, live)).toEqual([]);
    expect(detailStatus(manualJob, live)).toBe("READY");
  });

  it("상세페이지에 충돌하는 묶음 수량이 명시되면 차단한다", () => {
    const changed = { ...detail, title: "스킨1004 히알루 시카 워터핏 선 세럼 50ml, 3개", unitsPerPackage: 3 };
    expect(productMismatchReasons(job, changed)).toContain("UNITS_PER_PACKAGE");
    expect(detailStatus(job, changed)).toBe("PRODUCT_MISMATCH");
  });

  it("상세페이지에 충돌하는 용량이 명시되면 차단한다", () => {
    expect(productMismatchReasons(job, { ...detail, title: "스킨1004 히알루 시카 워터핏 선 세럼 150ml, 2개" })).toContain("UNIT_SIZE");
  });

  it("동일한 용량의 L/mL와 kg/g 표기를 허용한다", () => {
    const waterJob = { ...job, expectedUnitSize: "2L", expectedUnitsPerPackage: 1 };
    const waterDetail = { ...detail, title: "제주 생수 2000mL", unitsPerPackage: 1 };
    expect(productMismatchReasons(waterJob, waterDetail)).not.toContain("UNIT_SIZE");

    const foodJob = { ...job, expectedUnitSize: "1kg", expectedUnitsPerPackage: 1 };
    const foodDetail = { ...detail, title: "닭강정 1000g", unitsPerPackage: 1 };
    expect(productMismatchReasons(foodJob, foodDetail)).not.toContain("UNIT_SIZE");
  });

  it("SKU 식별자가 없을 때는 핵심 상품명으로 오배송을 차단한다", () => {
    const unidentified = { ...detail, vendorItemId: null, itemId: null };
    expect(detailStatus(job, { ...unidentified, title: "스킨1004 히알루 시카 워터핏 선 세럼 50ml, 2개" })).toBe("READY");
    expect(detailStatus(job, { ...unidentified, title: "스킨1004 톤 브라이트닝 선크림 50ml, 2개" })).toBe("PRODUCT_MISMATCH");
  });

  it("보안·로그인·가격·옵션·재고를 구분한다", () => {
    expect(detailStatus(job, { ...detail, securityRequired: true })).toBe("SECURITY_CHECK_REQUIRED");
    expect(detailStatus(job, { ...detail, loginRequired: true })).toBe("LOGIN_REQUIRED");
    expect(detailStatus(job, { ...detail, price: null })).toBe("PRICE_UNVERIFIED");
    expect(detailStatus(job, { ...detail, optionRequired: true })).toBe("OPTION_REQUIRED");
    expect(detailStatus(job, { ...detail, inStock: false })).toBe("OUT_OF_STOCK");
  });
});
