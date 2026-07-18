import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const config = readFileSync(new URL("../src/config.ts", import.meta.url), "utf8");
const app = readFileSync(new URL("../src/ui/App.tsx", import.meta.url), "utf8");
const background = readFileSync(new URL("../src/background.ts", import.meta.url), "utf8");

describe("GPT 앱 재연결 설정", () => {
  it("배포 빌드는 공개 서버를 기본 연결 대상으로 사용한다", () => {
    expect(config).toContain("https://ddakdama.ddakdama.workers.dev");
    expect(config).not.toContain("http://localhost:8787");
    expect(app).toContain('import { SERVER_ORIGIN } from "../config.js"');
    expect(background).toContain('import{SERVER_ORIGIN as serverOrigin}from"./config"');
  });

  it("연결 해제 후 새 코드 생성 경로를 사용자에게 제공한다", () => {
    expect(app).toContain("6자리 코드 만들기");
    expect(app).toContain("새 코드 다시 만들기");
    expect(app).toContain(">새 코드</button>");
    expect(app).toContain("다시 연결하려면 새 6자리 코드를 만들어 주세요");
  });
});
