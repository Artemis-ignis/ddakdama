import { describe, expect, it } from "vitest";
import { normalizeHandoffItems } from "../src/mcp.js";

describe("handoff normalization", () => {
  it("rebuilds product identity from raw text when a widget projection contains only a size", () => {
    const rawText = "\uC81C\uB85C \uC544\uC774\uC2A4\uD06C\uB9BC \uBC14 70~100ml \u00D7 10\uAC1C, 1\uC138\uD2B8";
    const [normalized] = normalizeHandoffItems([{ rawText, productName: "70mL" }]);

    expect(normalized.productName).toBe("\uC81C\uB85C \uC544\uC774\uC2A4\uD06C\uB9BC \uBC14");
    expect(normalized.rawText).toBe(rawText);
    expect(normalized.requestedPhysicalUnits).toBe(10);
  });
});
