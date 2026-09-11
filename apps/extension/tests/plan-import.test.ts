import { describe, expect, it } from "vitest";
import { parseShoppingLine } from "@ddakdama/core";
import { restorePlanRequest } from "../src/plan-import";
import { isTrustedPlanLink, PUBLIC_WEB_ORIGIN, SERVER_ORIGIN } from "../src/config";

describe("기존 GPT와 웹 계획의 원문 비저장 handoff", () => {
  it("상품 구조에서 규격과 수정 수량을 복원하고 비저장 문구를 검색하지 않는다", () => {
    const request = { ...parseShoppingLine("스킨1004 히알루 시카 워터핏 선 세럼 50ml 2개"), rawText: "입력 원문은 저장하지 않음", requestedPhysicalUnits: 4, requestedPurchaseUnits: 4 };
    const restored = restorePlanRequest(request);
    expect(restored.rawText).not.toContain("저장하지");
    expect(restored.requestedPhysicalUnits).toBe(4);
    expect(parseShoppingLine(restored.rawText)).toMatchObject({ unitSizeValue: 50, requestedPhysicalUnits: 4, productName: request.productName });
  });
  it("240정은 약병 240개가 아니라 내용량으로 유지한다", () => {
    const request = { ...parseShoppingLine("닥터스베스트 고흡수 마그네슘 100mg 240정"), rawText: "입력 원문은 저장하지 않음" };
    expect(parseShoppingLine(restorePlanRequest(request).rawText)).toMatchObject({ strengthValue: 100, packageContentCount: 240, requestedPhysicalUnits: 1 });
  });
  it("두 실제 운영 origin만 신뢰하고 임의 주소나 유사 도메인에는 토큰을 보내지 않는다", () => {
    for (const origin of [SERVER_ORIGIN, PUBLIC_WEB_ORIGIN]) expect(isTrustedPlanLink(`${origin}/?plan=abc&grant=xyz`)).toBe(true);
    for (const bad of ["https://evil.test/?plan=abc&grant=xyz", `${PUBLIC_WEB_ORIGIN}.evil.test/?plan=abc&grant=xyz`, `${PUBLIC_WEB_ORIGIN}/redirect?plan=abc&grant=xyz`, `${PUBLIC_WEB_ORIGIN}/?plan=abc`, PUBLIC_WEB_ORIGIN.replace("https://", "https://user:password@") + "/?plan=abc&grant=xyz"]) expect(isTrustedPlanLink(bad)).toBe(false);
  });
});
