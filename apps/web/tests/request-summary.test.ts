import { describe, expect, it } from "vitest";
import { parseShoppingLine } from "@ddakdama/core";
import { requestShoppingText, requestSpecification } from "../src/request-summary";

describe("GPT plan display without storing original prose", () => {
  it.each([
    ["닥터지 레드 블레미쉬 포 맨 진정 올인원 150ml 1개", "150mL · 실물 1개"],
    ["스킨1004 히알루 시카 워터핏 선 세럼 50ml 2개", "50mL · 실물 2개"],
    ["라운드랩 1025 독도 클렌저 150ml 2개", "150mL · 실물 2개"],
    ["TS 골드플러스 샴푸 500g 1개", "500g · 실물 1개"],
    ["닥터스베스트 고흡수 마그네슘 100mg 240정 1개", "100mg · 240정 · 실물 1개"],
  ])("retains specification and quantity: %s", (text, expected) => {
    const request = { ...parseShoppingLine(text), rawText: "입력 원문은 저장하지 않음" };
    expect(requestSpecification(request)).toBe(expected);
    expect(requestShoppingText(request)).not.toContain("입력 원문");
    const restored = parseShoppingLine(requestShoppingText(request));
    expect(restored.productName).toBe(request.productName);
    expect(restored.requestedPhysicalUnits).toBe(request.requestedPhysicalUnits);
    expect(restored.packageContentCount).toBe(request.packageContentCount);
    expect(request.rawText).toBe("입력 원문은 저장하지 않음");
  });

  it("uses edited quantity rather than stale original or normalized prose", () => {
    const request = { ...parseShoppingLine("클렌저 150ml 2개"), requestedPhysicalUnits: 4 };
    expect(requestSpecification(request)).toBe("150mL · 실물 4개");
    expect(requestShoppingText(request)).toBe("클렌저 150mL 4개");
  });

  it("preserves a size range when exact volume has not been selected", () => {
    const request = { ...parseShoppingLine("샴푸 1개"), variantTokens: ["size-range:400-600:mL"] };
    expect(requestSpecification(request)).toBe("400~600mL · 실물 1개");
  });
});
