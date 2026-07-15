import { describe, expect, it } from "vitest";
import {
  normalizePairingCode,
  secureShard,
  shardFromDeviceId,
  shardFromOpaqueToken,
  ttl,
} from "../src/helpers.js";
import { authorization } from "../src/partners.js";
import {
  landingPage,
  privacyPage,
  supportPage,
  termsPage,
} from "../src/site.js";

describe("공개 Worker 핵심 계약", () => {
  it("6자리 연결 코드와 샤드를 안전하게 구분한다", () => {
    expect(normalizePairingCode("123 456")).toBe("123456");
    expect(normalizePairingCode("000000")).toBeNull();
    expect(shardFromOpaqueToken(`4.${"a".repeat(43)}`)).toBe("4");
    expect(shardFromOpaqueToken("invalid")).toBeNull();
    expect(shardFromDeviceId("7_00000000-0000-4000-8000-000000000000")).toBe("7");
  });

  it("TTL은 안전한 상한과 기본값을 사용한다", () => {
    expect(ttl(undefined, 600)).toBe(600_000);
    expect(ttl("120", 600)).toBe(120_000);
    expect(ttl("999999999", 600)).toBe(2_592_000_000);
    expect(Number(secureShard())).toBeGreaterThanOrEqual(1);
    expect(Number(secureShard())).toBeLessThanOrEqual(9);
  });

  it("쿠팡 파트너스 HMAC은 Node 서버와 같은 형식을 만든다", async () => {
    const value = await authorization(
      "GET",
      "/v2/test?keyword=abc",
      { accessKey: "access", secretKey: "secret", subId: "ddakdama" },
      new Date("2026-07-14T01:02:03Z"),
    );
    expect(value).toMatch(
      /^CEA algorithm=HmacSHA256, access-key=access, signed-date=260714T010203Z, signature=[0-9a-f]{64}$/,
    );
  });

  it("공개 페이지에 운영·개인정보·지원 정보를 제공한다", () => {
    const icon = "data:image/png;base64,aWNvbg==";
    expect(landingPage(icon)).toContain("쇼핑 목록을<br>한 번에 장바구니로");
    expect(landingPage(icon)).toContain(icon);
    expect(privacyPage(icon)).toContain("지원 문의: 접수일로부터 최대 30일");
    expect(termsPage(icon)).toContain("자동 결제나 주문 확정을 수행하지 않으며");
    const support = supportPage(icon, {
      submitted: true,
      ticketId: "DD-12345678",
    });
    expect(support).toContain('action="/api/support"');
    expect(support).toContain("DD-12345678");
    expect(support).toContain("API 키, 비밀번호, 인증 코드, 결제 정보");
  });
});
