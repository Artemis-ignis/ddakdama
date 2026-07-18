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
  it("범위 용량 요청은 범위 안의 후보만 자동 선택한다", () => {
    const [iceBar] = parseShoppingList("\uC81C\uB85C \uC544\uC774\uC2A4\uD06C\uB9BC \uBC14 80~100ml \u00d7 10\uAC1C, 1\uC138\uD2B8");
    const insideRange = {
      title: "\uC81C\uB85C \uC544\uC774\uC2A4\uD06C\uB9BC \uBC14 90mL 10\uAC1C\uc785",
      currentPrice: 12_000,
      unitsPerPackage: 10,
      rocketDelivery: false,
      advertised: false,
    };
    expect(candidateMatchesRequest(iceBar!, insideRange)).toBe(true);
    expect(candidateMatchesRequest(iceBar!, { ...insideRange, title: "\uC81C\uB85C \uC544\uC774\uC2A4\uD06C\uB9BC \uBC14 120mL 10\uAC1C\uc785" })).toBe(false);
  });

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

  it("검색가격이 없어도 정확한 상품은 상세 확인 대상으로 선택한다", () => {
    const pricePending = { ...base, currentPrice: null };
    expect(candidateMatchesRequest(sun!, pricePending)).toBe(true);
    expect(selectBestCandidate(sun!, [pricePending])).toBe(pricePending);
  });

  it("실제 쿠팡 1+1 제목과 증정 문구가 있어도 50mL 2개 후보를 선택한다", () => {
    const liveCandidate = {
      ...base,
      title: "[본사 출고 정품] 스킨1004 마다가스카르 센텔라 히알루-시카 워터핏 선세럼 더블기획 1+1 (+여행용 미니 추가 증정), 2개, 50ml",
      currentPrice: 43_890,
    };
    expect(candidateMatchesRequest(sun!, liveCandidate)).toBe(true);
    expect(selectBestCandidate(sun!, [liveCandidate])).toBe(liveCandidate);
  });
});
