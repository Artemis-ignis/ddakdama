import { describe, expect, it } from "vitest";
import { parseShoppingList } from "@ddakdama/core";
import { candidateMatchesRequest, classifyCandidate, classifySearchCandidates, selectBestCandidate, selectDefaultCandidate, shortlistSearchCandidates } from "../src/candidate-selection.js";

const [sun] = parseShoppingList("스킨1004 히알루 시카 워터핏 선 세럼 50ml 2개");
const base = {
  title: "스킨1004 히알루 시카 워터핏 선 세럼 50mL 2개입",
  currentPrice: 20_000,
  unitsPerPackage: 2,
  rocketDelivery: true,
  advertised: false,
};

describe("상품 후보 자동선택", () => {
  it("대파 식재료에 채칼을 선택하지 않고 채칼 요청 자체는 보존한다", () => {
    const [food] = parseShoppingList("대파 1단");
    const tool = { ...base, title: "대파 채칼 파채", unitsPerPackage: 1 };
    const vegetable = { ...tool, title: "국내산 대파 1단" };
    expect(candidateMatchesRequest(food!, tool)).toBe(false);
    expect(selectDefaultCandidate(food!, [tool])).toBeNull();
    expect(shortlistSearchCandidates("대파 1단", [tool, vegetable])).toEqual([vegetable]);
    const [toolRequest] = parseShoppingList("대파 채칼 1개");
    expect(selectDefaultCandidate(toolRequest!, [tool])).toBe(tool);
  });
  it("구체적인 일치 후보가 없어도 첫 후보를 편집 가능한 기본 선택으로 보여준다", () => {
    const [request] = parseShoppingList("약산성 젤 클렌저 저자극 1개");
    const first = { ...base, title: "브랜드A 약산성 클렌저 150ml 1개", unitsPerPackage: 1 };
    const second = { ...first, title: "브랜드B 클렌징 젤 200ml 1개" };
    expect(selectDefaultCandidate(request!, [first, second])).toBe(first);
    expect(selectBestCandidate(request!, [first, second])).toBeNull();
    expect(classifyCandidate(request!, first).level).toBe("REVIEW");
  });
  it("기본 선택도 정확한 후보가 있으면 이를 우선하고 빈 결과를 만들지 않는다", () => {
    const first = { ...base, title: "다른 선크림" };
    expect(selectDefaultCandidate(sun!, [first, base])).toBe(base);
    expect(selectDefaultCandidate(sun!, [])).toBeNull();
    expect(selectDefaultCandidate(sun!, [{ ...first, unitsPerPackage: 0 }])).toBeNull();
  });
  it("앞의 광고 8개 뒤에 있는 규격 일치 상품도 후보에 포함한다", () => {
    const ads = Array.from({ length: 10 }, (_, i) => ({ ...base, title: `다른 선크림 ${i} 50ml`, advertised: true }));
    const result = shortlistSearchCandidates("스킨1004 히알루 시카 워터핏 선 세럼 50ml 2개", [...ads, base]);
    expect(result).toHaveLength(8);
    expect(result[0]).toBe(base);
    expect(selectBestCandidate(sun!, result)).toBe(base);
  });
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

  it("'또는' 선호 표현은 공통 제품명과 허용 대안이 맞는 후보만 선택한다", () => {
    const [iceBar] = parseShoppingList("제로 또는 저당 아이스크림 바 70~100ml × 10개, 1세트");
    const lowSugar = {
      title: "저당 아이스크림 바 90mL 10개입",
      currentPrice: 18_000,
      unitsPerPackage: 10,
      rocketDelivery: true,
      advertised: false,
    };
    expect(candidateMatchesRequest(iceBar!, lowSugar)).toBe(true);
    expect(candidateMatchesRequest(iceBar!, { ...lowSugar, title: "일반 아이스크림 바 90mL 10개입" })).toBe(false);
  });
  it("keeps a mismatched package as REVIEW instead of reporting no result", () => {
    const [melon] = parseShoppingList("\uBE59\uADF8\uB808 \uBA54\uB85C\uB098 \uBA5C\uB860 75ml \u00D7 5\uAC1C, 1\uC138\uD2B8");
    const sixPack = { title: "\uBE59\uADF8\uB808 \uBA54\uB85C\uB098 \uBA5C\uB860 75mL 6\uAC1C\uC785", currentPrice: 8_000, unitsPerPackage: 6, rocketDelivery: true, advertised: false };
    expect(candidateMatchesRequest(melon!, sixPack)).toBe(false);
    expect(classifyCandidate(melon!, sixPack)).toMatchObject({ level: "REVIEW", reasons: ["PACKAGE_QUANTITY"] });
    expect(classifySearchCandidates(melon!, [sixPack])).toBe("REVIEW");
    expect(classifySearchCandidates(melon!, [])).toBe("NONE");
    expect(selectBestCandidate(melon!, [sixPack])).toBeNull();
  });
});
