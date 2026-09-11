import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const background = readFileSync(new URL("../src/background.ts", import.meta.url), "utf8");
const app = readFileSync(new URL("../src/ui/App.tsx", import.meta.url), "utf8");

describe("실제 쿠팡 자동화 공개 베타 안전선", () => {
  it("기존 확장 기능은 기본 활성이고 명시적인 false만 비활성화한다", () => {
    for (const source of [background, app]) {
      expect(source).toMatch(/VITE_DDAKDAMA_REAL_COUPANG_AUTOMATION_ENABLED\s*!==\s*"false"/u);
      expect(source).not.toContain('MODE === "production"');
      expect(source).not.toContain('MODE==="production"');
    }
  });
});
