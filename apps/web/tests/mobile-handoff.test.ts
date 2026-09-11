import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("../src/main.tsx", import.meta.url), "utf8");

describe("GPT plan handoff", () => {
  it("resolves a fresh GPT CartPlan into the DdakDama discovery flow", () => {
    expect(source).toContain('output.plan.status === "DRAFT"');
    expect(source).toContain('output.plan.items.every((item) => item.candidates.length === 0)');
    expect(source).toContain('`/api/plans/${output.plan.id}/resolve`');
    expect(source).toContain("GPT 목록으로 딱담아 상품 후보를 찾고 있어요.");
  });
});

describe("웹에서 Android 실행 계획 인계", () => {
  it("사용자가 명시적으로 준비한 계획만 일회용 Android claim link로 넘긴다", () => {
    expect(source).toContain("/api/plans/${plan.id}/claim-link");
    expect(source).toContain("Android 앱 연결 준비");
    expect(source).toContain("딱담아 앱에서 열기");
    expect(source).not.toContain('"/api/executions"');
    expect(source).not.toContain("allowCanonicalFallback: true");
  });

  it("실제 제휴 링크가 없을 때도 제휴 링크라고 표시하지 않는다", () => {
    expect(source).toContain("candidate.affiliateVerified && candidate.affiliateUrl");
    expect(source).not.toContain("선택 상품의 제휴 링크 준비");
    expect(source).not.toContain("제휴 링크를 준비했습니다");
  });
});

describe("웹에서 Chrome 실행 계획 인계", () => {
  it("지원 기능이 확인된 확장프로그램에만 동일 계획을 바로 전달한다", () => {
    expect(source).toContain("DDAKDAMA_EXTENSION_PROBE");
    expect(source).toContain("DDAKDAMA_EXTENSION_IMPORT_PLAN");
    expect(source).toContain('event.data.supportsPlanImport === true ? "ready" : "outdated"');
    expect(source).toContain("Chrome 확장프로그램에서 계속하기");
    expect(source).toContain("Chrome 확장프로그램 설치 방법");
    expect(source).not.toContain("Chrome 확장프로그램으로 장바구니 담기");
  });
});

describe("GPT 사용 안내 접근성", () => {
  it("대화상자가 열리면 포커스를 가두고 배경 스크롤을 잠근다", () => {
    expect(source).toContain('document.body.style.overflow = "hidden"');
    expect(source).toContain('event.key !== "Tab"');
    expect(source).toContain("gptCloseButtonRef.current?.focus()");
    expect(source).toContain("previousFocus?.focus()");
  });
});
