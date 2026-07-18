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
