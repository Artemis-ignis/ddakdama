import { describe, expect, it } from "vitest";
import {
  LEGACY_WIDGET_URIS,
  WIDGET_URI,
  planFingerprintForWidget,
  safeToolResponseShape,
  structuredContentFromToolResponse,
  toolMetadataCandidates,
  toolResponseIsError,
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
    expect(WIDGET_URI).toBe("ui://widget/ddakdama-cart-v13.html");
    expect(LEGACY_WIDGET_URIS).toEqual([
      "ui://widget/ddakdama-cart-v12.html",
      "ui://widget/ddakdama-cart-v11.html",
      "ui://widget/ddakdama-cart-v10.html",
      "ui://widget/ddakdama-cart-v9.html",
      "ui://widget/ddakdama-cart-v8.html",
      "ui://widget/ddakdama-cart-v7.html",
      "ui://widget/ddakdama-cart-v6.html",
      "ui://widget/ddakdama-cart-v5.html",
    ]);
    expect(widgetHtml).toContain('rpcRequest("ui/initialize"');
    expect(widgetHtml.indexOf("const isToolResponseRecord")).toBeLessThan(
      widgetHtml.indexOf("let plan = window.openai?.toolOutput"),
    );
    expect(widgetHtml).toContain("const randomUuid = () =>");
    expect(widgetHtml).not.toContain("pairingNonce = crypto.randomUUID()");
    expect(widgetHtml).toContain("appCapabilities:{}");
    expect(widgetHtml).not.toContain("capabilities:{}}");
    expect(widgetHtml).toContain('rpcNotify("ui/notifications/initialized"');
    expect(widgetHtml).toContain("initializeBridgeOnce");
    expect(widgetHtml).toContain("}, 10000)");
    expect(widgetHtml).toContain("attempt < 3");
    expect(widgetHtml).toContain("recoverInitialPlan");
    expect(widgetHtml).toContain('rpcRequest("tools/call"');
    expect(widgetHtml).toContain("window.openai?.callTool");
    expect(widgetHtml).toContain('callTool("pair_extension_device"');
    expect(widgetHtml).toContain("pairing_nonce:pairingNonce");
    expect(widgetHtml).toContain("toolResponseMetadata");
    expect(widgetHtml).toContain("call_tool_result");
    expect(widgetHtml).toContain("waitForToolMeta");
    expect(widgetHtml).toContain('callTool("send_cart_plan"');
    expect(widgetHtml).toContain('callTool("get_cart_plan_status"');
    expect(widgetHtml).toContain('callTool("disconnect_extension_device"');
    expect(widgetHtml).toContain('src="data:image/png;base64,');
    expect(widgetHtml).not.toContain('maxlength="6"');
    expect(widgetHtml).toContain("normalizePairingCode");
    expect(widgetHtml).toContain("/^[0-9]{6}$/");
  });

  it("동일한 계획이 늦게 재수신돼도 진행 중인 handoff를 초기화하지 않는다", () => {
    const plan = {
      planId: "plan-stable-1",
      items: [
        {
          rawText: "생수 2L 6개",
          productName: "생수",
          unitSizeValue: 2,
          unitSizeUnit: "L",
          requestedPhysicalUnits: 6,
        },
      ],
    };
    expect(planFingerprintForWidget(plan)).toBe(
      planFingerprintForWidget(structuredClone(plan)),
    );
    expect(
      planFingerprintForWidget({
        ...plan,
        items: [{ ...plan.items[0], requestedPhysicalUnits: 5 }],
      }),
    ).not.toBe(planFingerprintForWidget(plan));
    expect(widgetHtml).toContain(
      "const samePlan = Boolean(nextFingerprint && nextFingerprint === planFingerprint)",
    );
    expect(widgetHtml).toContain("if (!samePlan) resetDelivery()");
    expect(widgetHtml).toContain("ddakdama.delivery.v1");
    expect(widgetHtml).toContain("if (handoffId !== checkedHandoffId) return");
  });

  it("MCP 브리지와 window.openai 호환 브리지 응답을 같은 구조로 읽는다", () => {
    const fullMcpResult = {
      structuredContent: { connected: true },
      _meta: { connectionGrant: "grant-full", grantExpiresAt: 123 },
    };
    const rawBridgeWrapper = { result: { call_tool_result: fullMcpResult } };
    const compatibilityResult = { connected: true };
    const snakeCaseResult = {
      result: { mcp_tool_result: { structured_content: { sent: true } } },
    };

    expect(structuredContentFromToolResponse(fullMcpResult)).toEqual({ connected: true });
    expect(structuredContentFromToolResponse(rawBridgeWrapper)).toEqual({ connected: true });
    expect(structuredContentFromToolResponse(compatibilityResult)).toEqual({ connected: true });
    expect(structuredContentFromToolResponse(snakeCaseResult)).toEqual({ sent: true });
    expect(toolMetadataCandidates(rawBridgeWrapper)).toContainEqual({
      connectionGrant: "grant-full",
      grantExpiresAt: 123,
    });
    expect(toolResponseIsError({ result: { isError: true } })).toBe(true);
    expect(safeToolResponseShape(rawBridgeWrapper).flat()).not.toContain("connectionGrant");
  });

  it("직접 호환 응답을 코드 만료로 오판하지 않도록 정규화 계층을 위젯에 포함한다", () => {
    expect(widgetHtml).toContain("structuredContentFromToolResponse");
    expect(widgetHtml).toContain("PAIRING_RESPONSE_UNKNOWN");
    expect(widgetHtml).toContain("unknown pair response shape");
    expect(widgetHtml).toContain("같은 코드를 그대로 두고 다시 시도해 주세요");
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
    expect(widgetHtml).toContain("ddakdama.connection.v3");
    expect(widgetHtml).toContain("pairingNonce,");
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
    expect(widgetHtml).toContain("applyHostContext({theme:window.openai?.theme})");
    expect(widgetHtml).toContain('message.method === "ui/notifications/host-context-changed"');
    expect(widgetHtml).toContain("context?.styles?.variables");
    expect(widgetHtml).toContain("applyHostContext({theme:globals.theme})");
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
