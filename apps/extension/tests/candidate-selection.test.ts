import { describe, expect, it } from "vitest";
import { parseShoppingList } from "@ddakdama/core";
import { candidateMatchesRequest, selectBestCandidate } from "../src/candidate-selection.js";

const [sun] = parseShoppingList("스킨1004 히알루 시카 워터핏 선 세럼 50ml 2개");
const base = {
  title: "스킨1004 히알루 시카 워터핏 선 세럼 50mL 2개입",
  currentPrice: 20_000,
  unitsPerPackage: 2,
  rocketDelivery: true,
  advertised: false,
};

describe("상품 후보 자동선택", () => {
  it("브랜드·제품명·용량·수량이 정확한 후보만 허용한다", () => {
    expect(candidateMatchesRequest(sun!, base)).toBe(true);
    expect(candidateMatchesRequest(sun!, { ...base, title: "스킨1004 마다가스카르 센텔라 선크림 50mL 2개입" })).toBe(false);
    expect(candidateMatchesRequest(sun!, { ...base, title: "스킨1004 히알루 시카 워터핏 선 세럼 100mL 2개입" })).toBe(false);
    expect(candidateMatchesRequest(sun!, { ...base, unitsPerPackage: 3 })).toBe(false);
  });

  it("부정확한 최저가보다 정확한 상품을 선택한다", () => {
    const mismatch = { ...base, title: "스킨1004 마다가스카르 센텔라 선크림 50mL 2개입", currentPrice: 6_000 };
    expect(selectBestCandidate(sun!, [mismatch, base])).toBe(base);
  });

  it("정확한 후보가 없으면 임의 대체하지 않는다", () => {
    expect(selectBestCandidate(sun!, [{ ...base, title: "스킨1004 다른 선크림 50mL 2개입" }])).toBeNull();
  });
});
