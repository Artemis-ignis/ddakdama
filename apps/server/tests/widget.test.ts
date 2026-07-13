import { describe, expect, it } from "vitest";
import { WIDGET_URI, widgetHtml } from "../src/widget.js";

describe("ChatGPT 위젯 계약", () => {
  it("내장 위젯 스크립트가 실행 가능한 JavaScript 문법이다", () => {
    const script = widgetHtml.match(
      /<script type="module">([\s\S]*?)<\/script>/,
    )?.[1];
    expect(script).toBeTruthy();
    expect(() => new Function(script!)).not.toThrow();
  });

  it("공식 component bridge로 연결·전송·상태 확인·연결 해제를 수행한다", () => {
    expect(WIDGET_URI).toBe("ui://widget/ddakdama-cart-v2.html");
    expect(widgetHtml).toContain('rpcRequest("ui/initialize"');
    expect(widgetHtml).toContain('rpcNotify("ui/notifications/initialized"');
    expect(widgetHtml).toContain('rpcRequest("tools/call"');
    expect(widgetHtml).toContain("window.openai?.callTool");
    expect(widgetHtml).toContain('callTool("pair_extension_device"');
    expect(widgetHtml).toContain('callTool("send_cart_plan"');
    expect(widgetHtml).toContain('callTool("get_cart_plan_status"');
    expect(widgetHtml).toContain('callTool("disconnect_extension_device"');
  });

  it("grant·handoff·idempotency 상태를 ChatGPT 호스트 상태로 복원한다", () => {
    expect(widgetHtml).toContain("window.openai?.widgetState");
    expect(widgetHtml).toContain("window.openai.setWidgetState");
    expect(widgetHtml).toContain("connectionGrant,");
    expect(widgetHtml).toContain("handoffId,");
    expect(widgetHtml).toContain("idempotencyKey,");
    expect(widgetHtml).not.toContain("ui/update-model-context");
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
