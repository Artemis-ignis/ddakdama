import { describe, expect, it } from "vitest";
import { isPlausibleCartLineTotal, parseWon } from "../src/coupang-price";

describe("쿠팡 가격 파서", () => {
  it("한 영역에 여러 금액이 있어도 숫자를 이어 붙이지 않는다", () => {
    const text = "상품금액 16,830원 · 적립 1,501원 · 주문 합계 32,320원";
    expect(parseWon(text)).toBe(16_830);
  });

  it("기존 버그처럼 비정상적으로 큰 연결 숫자는 가격으로 인정하지 않는다", () => {
    expect(parseWon("1,501,502,320,004,716,800,000,000원")).toBeNull();
    expect(parseWon("1025150250326000300000000000", true)).toBeNull();
  });

  it("data 속성의 정상적인 숫자 금액은 읽는다", () => {
    expect(parseWon("65400", true)).toBe(65_400);
  });

  it("상세 확인가와 동떨어진 장바구니 행 금액을 차단한다", () => {
    expect(isPlausibleCartLineTotal(65_400, 21_800, 3)).toBe(true);
    expect(isPlausibleCartLineTotal(1_501_502_320_004_716_800_000_000, 16_830, 1)).toBe(false);
  });
});
