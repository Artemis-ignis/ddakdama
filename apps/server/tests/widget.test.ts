import { describe, expect, it } from "vitest";
import {
  LEGACY_WIDGET_URIS,
  WIDGET_URI,
  widgetHtml,
} from "../src/widget.js";

describe("ChatGPT 위젯 계약", () => {
  it("내장 위젯 스크립트가 실행 가능한 JavaScript 문법이다", () => {
    const script = widgetHtml.match(
      /<script type="module">([\s\S]*?)<\/script>/,
    )?.[1];
    expect(script).toBeTruthy();
    expect(() => new Function(script!)).not.toThrow();
  });

  it("공식 component bridge로 연결·전송·상태 확인·연결 해제를 수행한다", () => {
    expect(WIDGET_URI).toBe("ui://widget/ddakdama-cart-v6.html");
    expect(LEGACY_WIDGET_URIS).toEqual([
      "ui://widget/ddakdama-cart-v5.html",
    ]);
    expect(widgetHtml).toContain('rpcRequest("ui/initialize"');
    expect(widgetHtml).toContain('rpcNotify("ui/notifications/initialized"');
    expect(widgetHtml).toContain('rpcRequest("tools/call"');
    expect(widgetHtml).toContain("window.openai?.callTool");
    expect(widgetHtml).toContain('callTool("pair_extension_device"');
    expect(widgetHtml).toContain('callTool("send_cart_plan"');
    expect(widgetHtml).toContain('callTool("get_cart_plan_status"');
    expect(widgetHtml).toContain('callTool("disconnect_extension_device"');
    expect(widgetHtml).toContain('src="data:image/png;base64,');
    expect(widgetHtml).not.toContain('maxlength="6"');
    expect(widgetHtml).toContain("normalizePairingCode");
    expect(widgetHtml).toContain("/^[0-9]{6}$/");
  });

  it("초기 도구 결과를 놓치지 않도록 호스트 이벤트를 브리지 초기화 전에 구독한다", () => {
    const messageListener = widgetHtml.indexOf('window.addEventListener("message"');
    const globalsListener = widgetHtml.indexOf('window.addEventListener("openai:set_globals"');
    const bridgeStart = widgetHtml.indexOf("const bridgeReady = initializeBridge()");

    expect(messageListener).toBeGreaterThan(-1);
    expect(globalsListener).toBeGreaterThan(-1);
    expect(messageListener).toBeLessThan(bridgeStart);
    expect(globalsListener).toBeLessThan(bridgeStart);
    expect(widgetHtml).toContain('message.method === "ui/notifications/tool-result"');
    expect(widgetHtml).toContain("event.detail?.globals");
    expect(widgetHtml).toContain("applyPlan(globals.toolOutput)");
  });

  it("grant·handoff·idempotency 상태를 ChatGPT 호스트 상태로 복원한다", () => {
    expect(widgetHtml).toContain("window.openai?.widgetState");
    expect(widgetHtml).toContain("window.openai.setWidgetState");
    expect(widgetHtml).toContain("connectionGrant,");
    expect(widgetHtml).toContain("handoffId,");
    expect(widgetHtml).toContain("idempotencyKey,");
    expect(widgetHtml).toContain("ddakdama.connection.v2");
    expect(widgetHtml).toContain("localStorage.setItem");
    expect(widgetHtml).toContain("localStorage.getItem");
    expect(widgetHtml).not.toContain("ui/update-model-context");
  });

  it("연결된 사용자의 새 계획을 확장 프로그램으로 자동 전송한다", () => {
    expect(widgetHtml).toContain("typeof plan.planId");
    expect(widgetHtml).toContain("void bridgeReady.then(() => sendPlan())");
  });

  it("ChatGPT의 밝은·어두운 테마를 모두 따라간다", () => {
    expect(widgetHtml).toContain("color-scheme:light dark");
    expect(widgetHtml).toContain(':root[data-theme="dark"]');
    expect(widgetHtml).toContain("@media(prefers-color-scheme:dark)");
    expect(widgetHtml).toContain("applyTheme(window.openai?.theme)");
    expect(widgetHtml).toContain("applyTheme(globals.theme)");
  });

  it("전송 후 버튼은 재전송하지 않고 실제 상태 도구를 호출한다", () => {
    expect(widgetHtml).toContain("if (handoffId) {");
    expect(widgetHtml).toContain("await checkStatus(true);");
    expect(widgetHtml).toContain("idempotency_key:idempotencyKey");
    expect(widgetHtml).not.toContain("idempotency_key:crypto.randomUUID()");
    expect(widgetHtml).toContain("전송 상태 다시 확인");
    expect(widgetHtml).toContain("확장 프로그램이 목록을 받았습니다.");
  });

  it("일반 사용자 화면에는 개발자 연결 정보를 노출하지 않는다", () => {
    const visibleMarkup = widgetHtml.split('<script type="module">')[0];
    for (const forbidden of [
      "MCP",
      "서버 주소",
      "server origin",
      "token",
      "handoff ID",
      "API endpoint",
      "Secret Key",
    ]) {
      expect(visibleMarkup).not.toContain(forbidden);
    }
    expect(visibleMarkup).toContain("일회용 6자리 코드");
    expect(visibleMarkup).toContain("연결 해제");
  });
});
