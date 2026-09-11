import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const background = readFileSync(new URL("../src/background.ts", import.meta.url), "utf8");
const content = readFileSync(new URL("../src/ddakdama-plan-content.ts", import.meta.url), "utf8");
const manifest = readFileSync(new URL("../manifest.json", import.meta.url), "utf8");

describe("웹·GPT 계획 Chrome handoff", () => {
  it("신뢰할 수 있는 딱담아 계획 링크만 side panel로 전달한다", () => {
    expect(background).toContain('message?.type==="DDAKDAMA_IMPORT_PLAN_LINK"');
    expect(background).toContain('trusted=isTrustedPlanLink(planUrl)');
    expect(background).toContain('"ddakdama-pending-plan-link"');
    expect(background).toContain("chrome.sidePanel.open");
  });

  it("공개 배포본은 사용자의 검토 버튼 뒤에만 검색·검증·담기 실행기를 제공한다", () => {
    expect(background).toContain('VITE_DDAKDAMA_REAL_COUPANG_AUTOMATION_ENABLED!=="false"');
    expect(background).not.toContain('import.meta.env.MODE==="production"');
    expect(background).toContain('error:"CART_AUTOMATION_DISABLED"');
    expect(background).toContain('message?.type==="DDAKDAMA_RUN_CART_JOBS"');
    expect(background).toContain('message?.type==="DDAKDAMA_PREFLIGHT"');
  });

  it("웹에서는 백그라운드 기능까지 확인한 뒤 계획을 넘긴다", () => {
    expect(content).toContain("DDAKDAMA_EXTENSION_PROBE");
    expect(content).toContain('sendMessage({ type: "DDAKDAMA_PING" })');
    expect(content).toContain("supportsPlanImport");
    expect(content).toContain("DDAKDAMA_EXTENSION_IMPORT_PLAN");
    expect(content).toContain("DDAKDAMA_IMPORT_PLAN_LINK");
    expect(background).toContain("supportsPlanImport:true");
    expect(manifest).toContain("dist/handoff-content.js");
  });
});
