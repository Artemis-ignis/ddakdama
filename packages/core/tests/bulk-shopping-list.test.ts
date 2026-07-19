import { describe, expect, it } from "vitest";
import { parseShoppingList, parseUnitsPerPackage } from "../src/index.js";

const bulkList = [
  "1. \uBB34\uB77C\uBCA8 \uC0DD\uC218 500ml \u00d7 20\uBCD1, 1\uBC15\uC2A4",
  "2. \uC81C\uB85C \uD0C4\uC0B0\uC74C\uB8CC \uD63C\uD569 355ml \u00d7 24\uCE94, 1\uBC15\uC2A4",
  "3. \uC774\uC628\uC74C\uB8CC 500ml \u00d7 12\uBCD1, 1\uBB36\uC74C",
  "4. \uC544\uC774\uC2A4\uD2F0 \uBCF5\uC22D\uC544\uB9DB \uC81C\uB85C 500ml \u00d7 12\uBCD1, 1\uBB36\uC74C",
  "5. \uC81C\uB85C \uC544\uC774\uC2A4\uD06C\uB9BC \uBC14 80~100ml \u00d7 10\uAC1C, 1\uC138\uD2B8",
  "6. \uD325\uBE59\uC218 \uC544\uC774\uC2A4\uD06C\uB9BC 280~300ml \u00d7 4\uAC1C, 1\uC138\uD2B8",
  "7. \uB0C9\uBA74 2\uC778\uBD84 900g~1.2kg, 2\uBD09",
  "8. \uBA54\uBC00\uC18C\uBC14 2\uC778\uBD84 550~700g, 2\uBD09",
  "9. \uC218\uBC15 6~8kg, 1\uD1B5",
  "10. \uB0C9\uB3D9 \uB9DD\uACE0 1kg, 1\uBD09",
].join("\n");

describe("bulk grocery list parsing", () => {
  const lines = parseShoppingList(bulkList);

  it("removes list numbers and keeps ten searchable product identities", () => {
    expect(lines).toHaveLength(10);
    expect(lines.map((line) => line.productName)).toEqual([
      "\uBB34\uB77C\uBCA8 \uC0DD\uC218",
      "\uC81C\uB85C \uD0C4\uC0B0\uC74C\uB8CC \uD63C\uD569",
      "\uC774\uC628\uC74C\uB8CC",
      "\uC544\uC774\uC2A4\uD2F0 \uBCF5\uC22D\uC544\uB9DB \uC81C\uB85C",
      "\uC81C\uB85C \uC544\uC774\uC2A4\uD06C\uB9BC \uBC14",
      "\uD325\uBE59\uC218 \uC544\uC774\uC2A4\uD06C\uB9BC",
      "\uB0C9\uBA74 2\uC778\uBD84",
      "\uBA54\uBC00\uC18C\uBC14 2\uC778\uBD84",
      "\uC218\uBC15",
      "\uB0C9\uB3D9 \uB9DD\uACE0",
    ]);
  });

  it("does not confuse package contents with requested cart quantities", () => {
    expect(lines.map((line) => line.requestedPhysicalUnits)).toEqual([20, 24, 12, 12, 10, 4, 2, 2, 1, 1]);
    expect(lines.reduce((total, line) => total + line.requestedPhysicalUnits, 0)).toBe(88);
    expect(lines.map((line) => line.requestedPurchaseUnits)).toEqual([1, 1, 1, 1, 1, 1, 2, 2, 1, 1]);
  });

  it("retains ranges as searchable constraints instead of product-name text", () => {
    expect(lines[4].variantTokens).toContain("size-range:80-100:mL");
    expect(lines[6].variantTokens).toContain("size-range:900-1200:g");
    expect(lines[8]).toMatchObject({ unitSizeValue: 6, unitSizeUnit: "kg" });
    expect(lines[8].variantTokens).toContain("size-range:6-8:kg");
  });

  it("reads beverage packages as purchase units while preserving tablet bottles", () => {
    expect(parseUnitsPerPackage("\uBB34\uB77C\uBCA8 \uC0DD\uC218 500ml \u00d7 20\uBCD1")).toBe(20);
    expect(parseUnitsPerPackage("\uC81C\uB85C \uD0C4\uC0B0\uC74C\uB8CC 355ml 24\uCE94")).toBe(24);
    expect(parseUnitsPerPackage("\uB9C8\uADF8\uB124\uC298 100mg 240\uC815")).toBe(1);
  });
});

describe("GPT normalized shopping-list contract", () => {
  const lines = parseShoppingList([
    "\uC0DD\uC218 1L \u00d7 12\uBCD1, 1\uBB36\uC74C",
    "\uB0C9\uBA74 2\uC778\uBD84 \uAD6C\uC131, \uCD1D 4\uC778\uBD84",
    "\uBE44\uBE54\uBA74 130g \uB0B4\uC678 \u00d7 5\uBD09, 1\uD329",
    "\uB0C9\uB3D9 \uCE58\uD0A8\uD150\uB354 1kg \uB0B4\uC678, 1\uBD09",
  ].join("\n"));

  it("converts serving totals into purchasable packages", () => {
    expect(lines[1]).toMatchObject({
      productName: "\uB0C9\uBA74",
      packageContentCount: 2,
      packageContentUnit: "\uC778\uBD84",
      requestedPhysicalUnits: 2,
      requestedPurchaseUnits: 2,
    });
  });

  it("keeps the requested pack separate from the physical contents", () => {
    expect(lines[2]).toMatchObject({ productName: "\uBE44\uBE54\uBA74", requestedPhysicalUnits: 5, requestedPurchaseUnits: 1 });
    expect(lines[3]).toMatchObject({ productName: "\uB0C9\uB3D9 \uCE58\uD0A8\uD150\uB354", requestedPhysicalUnits: 1, requestedPurchaseUnits: 1 });
  });

  it("turns approximate size wording into a comparison range without keeping it in the search name", () => {
    expect(lines[2].variantTokens).toContain("size-range:104-156:g");
    expect(lines[3].variantTokens).toContain("size-range:0.8-1.2:kg");
  });
});

describe("real-world summer grocery list regression", () => {
  const lines = parseShoppingList([
    "생수 1L × 12병, 1묶음",
    "제로 탄산음료 355ml × 12캔, 1박스",
    "이온음료 500ml × 6병, 1묶음",
    "냉면 2인분 구성, 총 4인분",
    "메밀소바 2인분 구성, 총 4인분",
    "비빔면 130g 내외 × 5봉, 1팩",
    "냉동 치킨텐더 1kg 내외, 1봉",
    "냉동 군만두 1kg 내외, 1봉",
    "제로 또는 저당 아이스크림 바 70~100ml × 10개, 1세트",
    "개별포장 젤리 또는 과일젤리 20~30g × 10개, 1봉",
    "수박 5kg 1개",
  ].join("\n"));

  it("keeps every requested product as a searchable plan row", () => {
    expect(lines).toHaveLength(11);
    expect(lines.map((line) => line.productName)).toEqual([
      "생수", "제로 탄산음료", "이온음료", "냉면", "메밀소바", "비빔면",
      "냉동 치킨텐더", "냉동 군만두", "제로 또는 저당 아이스크림 바",
      "개별포장 젤리 또는 과일젤리", "수박",
    ]);
  });

  it("separates package contents, servings and cart quantities", () => {
    expect(lines.map((line) => line.requestedPhysicalUnits)).toEqual([12, 12, 6, 2, 2, 5, 1, 1, 10, 10, 1]);
    expect(lines.map((line) => line.requestedPurchaseUnits)).toEqual([1, 1, 1, 2, 2, 1, 1, 1, 1, 1, 1]);
    expect(lines[3]).toMatchObject({ packageContentCount: 2, packageContentUnit: "인분" });
    expect(lines[4]).toMatchObject({ packageContentCount: 2, packageContentUnit: "인분" });
  });
});

describe("retail-ready exact grocery list regression", () => {
  const lines = parseShoppingList([
    "몽베스트 위드어스 무라벨 생수 1L 12개입 1팩",
    "스프라이트 제로 355ml 12개입 1박스",
    "토레타 제로 500ml 6개입 1팩",
    "풀무원 평양 물냉면 2인분 2팩",
    "풀무원 가쓰오 메밀소바 2인분 2팩",
    "팔도 비빔면 130g 5개입 1팩",
    "하림 용가리치킨 텐더스틱 1kg 1봉",
    "비비고 군만두 950g 1봉",
    "라라스윗 저당 초콜릿 아이스크림바 90ml 10개입 1세트",
    "쁘띠첼 과일젤리 20~30g 개별포장 10개입 1봉",
    "당도선별 통수박 5kg 내외 1통",
  ].join("\n"));

  it("keeps all eleven exact shopping intents searchable", () => {
    expect(lines).toHaveLength(11);
    expect(lines.map((line) => line.productName)).toEqual([
      "몽베스트 위드어스 무라벨 생수",
      "스프라이트 제로",
      "토레타 제로",
      "풀무원 평양 물냉면 2인분",
      "풀무원 가쓰오 메밀소바 2인분",
      "팔도 비빔면",
      "하림 용가리치킨 텐더스틱",
      "비비고 군만두",
      "라라스윗 저당 초콜릿 아이스크림바",
      "쁘띠첼 과일젤리 개별포장",
      "당도선별 통수박",
    ]);
  });

  it("expands 개입 packages into physical contents without multiplying cart packs", () => {
    expect(lines.map((line) => line.requestedPhysicalUnits)).toEqual([12, 12, 6, 2, 2, 5, 1, 1, 10, 10, 1]);
    expect(lines.map((line) => line.requestedPurchaseUnits)).toEqual([1, 1, 1, 2, 2, 1, 1, 1, 1, 1, 1]);
    expect(lines[0]).toMatchObject({ packageContentCount: 12, packageContentUnit: "개입", requestedPhysicalUnits: 12, requestedPurchaseUnits: 1 });
    expect(lines[8]).toMatchObject({ packageContentCount: 10, packageContentUnit: "개입", requestedPhysicalUnits: 10, requestedPurchaseUnits: 1 });
  });
});
