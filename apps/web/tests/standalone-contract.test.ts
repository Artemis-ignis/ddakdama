import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { createCartPlan } from "@ddakdama/core";

const source = readFileSync(new URL("../src/main.tsx", import.meta.url), "utf8");

describe("standalone web entry", () => {
  it("can start from a direct shopping list without ChatGPT pairing", () => {
    const plan = createCartPlan("생수 1L 12병", "00000000-0000-4000-8000-000000000003", 100);
    expect(plan.items).toHaveLength(1);
    expect(plan.status).toBe("DRAFT");
  });

  it("shows a setup guide before sending a user to ChatGPT", () => {
    expect(source).toContain("GPT로 대화하며 목록 만들기");
    expect(source).toContain("딱담아 GPT 열기");
    expect(source).toContain("https://chatgpt.com/g/g-6a5ec60a6c308191bc5b342f67c2772d-ddagdama-syoping-doumi");
  });

  it("keeps empty product results consumer-facing instead of exposing implementation steps", () => {
    expect(source).toContain("쇼핑 목록을 준비했어요");
    expect(source).toContain("쿠팡에서 상품 보기");
    expect(source).toContain("이 포스팅은 쿠팡 파트너스 활동의 일환으로");
    expect(source).not.toContain("파트너스 API 없이도 계속할 수 있습니다");
    expect(source).not.toContain("선택 상품의 제휴 링크 준비");
  });

  it("presents ambiguity clarification, voice input, and the bottom assistant", () => {
    expect(source).toContain("몇 가지만 확인할게요");
    expect(source).toContain("음성 입력");
    expect(source).toContain("AI에게 물어보기");
    expect(source).toContain("/api/plans/${plan.id}/clarify");
    expect(source).toContain("수량 늘리기");
    expect(source).toContain("consentToStoreRaw");
    expect(source).toContain("raw-consent");
    expect(source).toContain("/api/events");
    expect(source).toContain("CLARIFICATION_ANSWERED");
  });
});
