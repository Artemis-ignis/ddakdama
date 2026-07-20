import { describe, expect, it } from "vitest";
import { parseShoppingList } from "../src/index.js";

const summerList = [
  "\uC81C\uB85C \uC544\uC774\uC2A4\uD06C\uB9BC \uBC14 70~100ml \u00D7 10\uAC1C, 1\uC138\uD2B8",
  "\uC218\uBC15 5~7kg, 1\uD1B5",
  "\uB0C9\uB3D9 \uB9DD\uACE0 \uCCAD\uD06C 1kg, 1\uBD09",
  "\uACFC\uC77C\uC824\uB9AC \uAC1C\uBCC4\uD3EC\uC7A5 20~30g \u00D7 10\uAC1C, 1\uBD09",
  "\uCEF5 \uACFC\uC77C \uB610\uB294 \uACFC\uC77C\uCEF5 100~150g \u00D7 6\uAC1C, 1\uC138\uD2B8",
  "\uD325\uBE59\uC218\uC6A9 \uBE59\uC218\uB5A1 200~300g, 1\uBD09",
  "\uC5F0\uC720 500g \uB0B4\uC678, 1\uAC1C",
  "\uB0C9\uB3D9 \uCE58\uC988\uD56B\uB3C4\uADF8 80~100g \u00D7 5\uAC1C, 1\uBD09",
  "\uAD6C\uC6B4 \uC624\uC9D5\uC5B4 \uB610\uB294 \uBC84\uD130\uAD6C\uC774 \uC624\uC9D5\uC5B4 150~250g, 1\uBD09",
  "\uB098\uCD08\uCE69 300~500g, 1\uBD09",
].join("\n");

describe("summer grocery handoff contract", () => {
  const lines = parseShoppingList(summerList);

  it("keeps all ten product identities separate from their size ranges", () => {
    expect(lines).toHaveLength(10);
    expect(lines.map((line) => line.productName)).toEqual([
      "\uC81C\uB85C \uC544\uC774\uC2A4\uD06C\uB9BC \uBC14",
      "\uC218\uBC15",
      "\uB0C9\uB3D9 \uB9DD\uACE0 \uCCAD\uD06C",
      "\uACFC\uC77C\uC824\uB9AC \uAC1C\uBCC4\uD3EC\uC7A5",
      "\uCEF5 \uACFC\uC77C \uB610\uB294 \uACFC\uC77C\uCEF5",
      "\uD325\uBE59\uC218\uC6A9 \uBE59\uC218\uB5A1",
      "\uC5F0\uC720",
      "\uB0C9\uB3D9 \uCE58\uC988\uD56B\uB3C4\uADF8",
      "\uAD6C\uC6B4 \uC624\uC9D5\uC5B4 \uB610\uB294 \uBC84\uD130\uAD6C\uC774 \uC624\uC9D5\uC5B4",
      "\uB098\uCD08\uCE69",
    ]);
  });

  it("keeps requested physical quantities without turning ranges into product names", () => {
    expect(lines.map((line) => line.requestedPhysicalUnits)).toEqual([10, 1, 1, 10, 6, 1, 1, 5, 1, 1]);
    expect(lines.map((line) => line.requestedPurchaseUnits)).toEqual([1, 1, 1, 1, 1, 1, 1, 1, 1, 1]);
    expect(lines[0].variantTokens).toContain("size-range:70-100:mL");
    expect(lines[1].variantTokens).toContain("size-range:5-7:kg");
  });

  it("preserves the ten fixed summer product names apart from size and purchase quantities", () => {
    const fixed = parseShoppingList([
      "\uB86F\uB370\uC6F0\uD478\uB4DC \uC124\uB808\uC784 \uBC00\uD06C\uC258\uC774\uD06C 160ml \u00D7 5\uAC1C, 1\uC138\uD2B8",
      "\uBE59\uADF8\uB808 \uB354\uC704\uC0AC\uB0E5 \uCEE4\uD53C 140ml \u00D7 5\uAC1C, 1\uC138\uD2B8",
      "\uBE59\uADF8\uB808 \uBA54\uB85C\uB098 \uBA5C\uB860 75ml \u00D7 10\uAC1C, 1\uC138\uD2B8",
      "\uB86F\uB370\uC6F0\uD478\uB4DC \uC81C\uB85C \uC218\uBC15\uBC14 75ml \u00D7 10\uAC1C, 1\uC138\uD2B8",
      "\uB3CC \uD6C4\uB8AF\uCEF5 \uBCF5\uC22D\uC544 198g \u00D7 4\uAC1C, 1\uC138\uD2B8",
      "\uD558\uB9AC\uBCF4 \uACE8\uB4DC\uBCA0\uB80C \uBBF8\uB2C8 10g \u00D7 25\uAC1C\uC785, 1\uBD09",
      "\uC624\uB9AC\uC628 \uCD08\uCF54\uC1A1\uC774 50g \u00D7 8\uAC1C, 1\uBC15\uC2A4",
      "\uB18D\uC2EC \uC0C8\uC6B0\uAE61 90g \u00D7 5\uBD09, 1\uC138\uD2B8",
      "\uB3D9\uC6D0 \uB9AC\uCC54 \uAE40\uCE58\uBCF6\uC74C\uBC25 210g \u00D7 5\uAC1C, 1\uC138\uD2B8",
      "\uD314\uB3C4 \uBE44\uBE54\uBA74 130g \u00D7 5\uBD09, 1\uD329",
    ].join("\n"));
    expect(fixed.map((line) => line.productName)).toEqual([
      "\uB86F\uB370\uC6F0\uD478\uB4DC \uC124\uB808\uC784 \uBC00\uD06C\uC258\uC774\uD06C", "\uBE59\uADF8\uB808 \uB354\uC704\uC0AC\uB0E5 \uCEE4\uD53C", "\uBE59\uADF8\uB808 \uBA54\uB85C\uB098 \uBA5C\uB860", "\uB86F\uB370\uC6F0\uD478\uB4DC \uC81C\uB85C \uC218\uBC15\uBC14", "\uB3CC \uD6C4\uB8AF\uCEF5 \uBCF5\uC22D\uC544", "\uD558\uB9AC\uBCF4 \uACE8\uB4DC\uBCA0\uB80C \uBBF8\uB2C8", "\uC624\uB9AC\uC628 \uCD08\uCF54\uC1A1\uC774", "\uB18D\uC2EC \uC0C8\uC6B0\uAE61", "\uB3D9\uC6D0 \uB9AC\uCC54 \uAE40\uCE58\uBCF6\uC74C\uBC25", "\uD314\uB3C4 \uBE44\uBE54\uBA74",
    ]);
    expect(fixed.map((line) => line.requestedPhysicalUnits)).toEqual([5, 5, 10, 10, 4, 25, 8, 5, 5, 5]);
    expect(fixed.map((line) => line.requestedPurchaseUnits)).toEqual([1, 1, 1, 1, 1, 1, 1, 1, 1, 1]);
  });
});
