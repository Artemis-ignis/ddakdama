import { describe, expect, it } from "vitest";
import {
  normalizePairingCode,
  secureShard,
  shardFromDeviceId,
  shardFromOpaqueToken,
  ttl,
} from "../src/helpers.js";
import { authorization } from "../src/partners.js";
import { landingPage, privacyPage, supportPage, termsPage } from "../src/site.js";

describe("public Worker helper contracts", () => {
  it("normalizes a pairing code and isolates opaque token shards", () => {
    expect(normalizePairingCode("123 456")).toBe("123456");
    expect(normalizePairingCode("000000")).toBeNull();
    expect(shardFromOpaqueToken(`4.${"a".repeat(43)}`)).toBe("4");
    expect(shardFromOpaqueToken("invalid")).toBeNull();
    expect(shardFromDeviceId("7_00000000-0000-4000-8000-000000000000")).toBe("7");
  });

  it("uses bounded TTL values and a valid shard", () => {
    expect(ttl(undefined, 600)).toBe(600_000);
    expect(ttl("120", 600)).toBe(120_000);
    expect(ttl("999999999", 600)).toBe(2_592_000_000);
    expect(Number(secureShard())).toBeGreaterThanOrEqual(1);
    expect(Number(secureShard())).toBeLessThanOrEqual(9);
  });

  it("matches the node service's Coupang Partners HMAC format", async () => {
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

  it("renders public landing, privacy, terms, and support pages", () => {
    const appIcon = "data:image/png;base64,aWNvbg==";
    const landing = landingPage(appIcon);
    expect(landing).toContain("쇼핑 목록을,");
    expect(landing).toContain("정확한 장바구니로.");
    expect(landing).toContain(appIcon);
    expect(landing).toContain('href="/support"');
    expect(privacyPage(appIcon)).toContain("지원 문의: 접수일로부터 최대 30일");
    expect(termsPage(appIcon)).toContain("자동 결제나 주문 확정을 실행하지 않습니다.");
    const support = supportPage(appIcon, { submitted: true, ticketId: "DD-12345678" });
    expect(support).toContain('action="/api/support"');
    expect(support).toContain("DD-12345678");
    expect(support).toContain("API 키, 비밀번호, 인증 코드, 결제 정보");
  });
});
