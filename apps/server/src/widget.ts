import { readFileSync } from "node:fs";

export const WIDGET_URI = "ui://widget/ddakdama-cart-v6.html";

const WIDGET_ICON = `data:image/png;base64,${readFileSync(
  new URL("../assets/icon-48.png", import.meta.url),
).toString("base64")}`;

export const widgetHtml = `<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <style>
    :root{
      color-scheme:light dark;
      font-family:Inter,Pretendard,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
      --page:transparent;--surface:#fff;--surface-soft:#f7f8fa;--surface-blue:#f2f7ff;
      --text:#191f28;--text-sub:#6b7684;--text-muted:#8b95a1;--line:#e5e8eb;
      --input:#fff;--primary:#3182f6;--primary-strong:#1769e0;--primary-soft:#e8f3ff;
      --success:#16883f;--success-bg:#edf8f1;--danger:#e42939;--shadow:0 12px 32px rgba(0,23,51,.07)
    }
    :root[data-theme="dark"]{
      --surface:#17191c;--surface-soft:#212429;--surface-blue:#17243a;
      --text:#f2f4f6;--text-sub:#c7cbd1;--text-muted:#9199a4;--line:#30343a;
      --input:#23272c;--primary:#4d91ff;--primary-strong:#82b2ff;--primary-soft:#172d4d;
      --success:#5bd686;--success-bg:#163224;--danger:#ff6b78;--shadow:0 16px 42px rgba(0,0,0,.28)
    }
    *{box-sizing:border-box}body{margin:0;padding:12px;background:var(--page);color:var(--text)}
    .wrap{background:var(--surface);border:1px solid var(--line);border-radius:24px;padding:18px;box-shadow:var(--shadow)}
    .head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px}.brand{display:flex;align-items:center;gap:10px}
    .logo{display:block;width:38px;height:38px;border-radius:13px;object-fit:cover;box-shadow:0 4px 14px rgba(49,130,246,.22)}
    .eyebrow{margin:0 0 2px;color:var(--text-muted);font-size:11px;font-weight:750}h2{margin:0;font-size:20px;letter-spacing:-.45px}
    .sub{color:var(--text-sub);font-size:13px;line-height:1.55;margin:14px 0 16px}
    .connection{display:flex;align-items:center;gap:6px;border-radius:999px;padding:7px 10px;background:var(--surface-soft);color:var(--text-sub);font-size:11px;font-weight:750;white-space:nowrap}
    .connection::before{content:"";width:7px;height:7px;border-radius:50%;background:var(--text-muted)}.connection.connected{background:var(--primary-soft);color:var(--primary-strong)}.connection.connected::before{background:var(--primary)}
    .summary{display:flex;justify-content:space-between;background:var(--surface-blue);padding:13px 14px;border-radius:15px;font-weight:850;color:var(--primary-strong)}
    .items{margin:12px 0;display:grid;gap:8px}.item{padding:13px;border:1px solid var(--line);border-radius:15px;background:var(--surface)}.item b{display:block;font-size:13px;line-height:1.45}
    .specs{display:flex;flex-wrap:wrap;gap:7px;margin-top:10px}.specs label{display:flex;align-items:center;gap:5px;color:var(--text-muted);font-size:10px;font-weight:650}
    .specs input{width:60px;border:1px solid var(--line);border-radius:10px;padding:8px;color:var(--text);background:var(--input);font:inherit;outline:none}.specs input:focus,.pair input:focus{border-color:var(--primary);box-shadow:0 0 0 3px color-mix(in srgb,var(--primary) 20%,transparent)}
    .connect-card{margin-top:14px;padding:14px;border:1px solid var(--line);border-radius:17px;background:var(--surface-soft)}.connect-title{margin:0 0 4px;font-size:13px;font-weight:850}.connect-help{margin:0 0 11px;color:var(--text-muted);font-size:11px;line-height:1.5}
    .pair{display:flex;gap:8px}.pair input{min-width:0;flex:1;border:1px solid var(--line);border-radius:12px;padding:11px;color:var(--text);background:var(--input);font-size:16px;letter-spacing:4px;text-align:center;outline:none}
    .button{border:0;border-radius:12px;padding:12px 14px;font-weight:850;cursor:pointer;transition:transform .12s ease,filter .12s ease}.button:hover:not(:disabled){filter:brightness(.97)}.button:active:not(:disabled){transform:scale(.985)}.button:disabled{cursor:not-allowed;opacity:.45}
    .pair .button{color:var(--primary-strong);background:var(--primary-soft)}.actions{display:grid;grid-template-columns:1fr auto;gap:8px;margin-top:12px}.primary{color:#fff;background:var(--primary)}.secondary{color:var(--text-sub);background:var(--surface-soft)}
    .status{display:flex;align-items:flex-start;gap:8px;margin:12px 2px 0;color:var(--text-sub);font-size:11px;line-height:1.5}.status::before{content:"";flex:0 0 auto;width:8px;height:8px;margin-top:4px;border-radius:50%;background:var(--text-muted)}
    .status.success{color:var(--success)}.status.success::before{background:var(--success)}.status.error{color:var(--danger)}.status.error::before{background:var(--danger)}.status.busy::before{background:var(--primary);animation:pulse 1s infinite}
    .received{display:none;margin-top:12px;padding:12px;border-radius:14px;background:var(--success-bg);color:var(--success);font-size:12px;font-weight:750}.received.show{display:block}
    @keyframes pulse{50%{opacity:.3}}
    @media(prefers-color-scheme:dark){:root:not([data-theme="light"]){--surface:#17191c;--surface-soft:#212429;--surface-blue:#17243a;--text:#f2f4f6;--text-sub:#c7cbd1;--text-muted:#9199a4;--line:#30343a;--input:#23272c;--primary:#4d91ff;--primary-strong:#82b2ff;--primary-soft:#172d4d;--success:#5bd686;--success-bg:#163224;--danger:#ff6b78;--shadow:0 16px 42px rgba(0,0,0,.28)}}
    @media(max-width:420px){body{padding:8px}.wrap{padding:15px}.head{align-items:center}.eyebrow{display:none}.connection{padding:6px 8px}.actions{grid-template-columns:1fr}.secondary{width:100%}}
  </style>
</head>
<body>
  <main class="wrap">
    <header class="head">
      <div class="brand"><img class="logo" src="${WIDGET_ICON}" alt=""><div><p class="eyebrow">쇼핑 목록을 한 번에</p><h2>딱담아</h2></div></div>
      <span class="connection" id="connection">연결 안 됨</span>
    </header>
    <p class="sub">상품 규격과 수량을 확인한 뒤 Chrome 확장 프로그램으로 보내세요. 실제 상품과 가격은 확장 프로그램에서 다시 확인합니다.</p>
    <div class="summary"><span id="kinds">상품 0종</span><span id="units">실물 0개</span></div>
    <div class="items" id="items"></div>
    <section class="connect-card" id="connectCard">
      <p class="connect-title">확장 프로그램 연결</p>
      <p class="connect-help">딱담아 확장 프로그램에 표시된 일회용 6자리 코드를 입력해 주세요.</p>
      <div class="pair"><input id="pairing" inputmode="numeric" autocomplete="one-time-code" enterkeyhint="done" placeholder="000000" aria-label="확장 프로그램 연결 코드"><button class="button" id="pair">연결</button></div>
    </section>
    <div class="actions"><button class="button primary" id="send" disabled>확장 프로그램으로 보내기</button><button class="button secondary" id="disconnect" hidden>연결 해제</button></div>
    <div class="received" id="received">확장 프로그램이 목록을 받았습니다. 이제 확장 프로그램에서 상품과 가격을 확인해 주세요.</div>
    <p class="status" id="status" aria-live="polite">먼저 확장 프로그램을 6자리 코드로 연결해 주세요.</p>
  </main>
  <script type="module">
    const STATE_VERSION = 2;
    const CONNECTION_STORAGE_KEY = "ddakdama.connection.v2";
    const SEND_LABEL = "확장 프로그램으로 보내기";
    const CHECK_LABEL = "전송 상태 다시 확인";
    const RECEIVED_LABEL = "수신 완료";
    const hostState = window.openai?.widgetState && typeof window.openai.widgetState === "object"
      ? window.openai.widgetState
      : {};
    const storedConnection = (() => {
      try {
        const value = JSON.parse(localStorage.getItem(CONNECTION_STORAGE_KEY) || "null");
        return value && typeof value === "object" ? value : {};
      } catch {
        return {};
      }
    })();
    let plan = window.openai?.toolOutput || {};
    let connectionGrant = typeof hostState.connectionGrant === "string"
      ? hostState.connectionGrant
      : typeof storedConnection.connectionGrant === "string"
        ? storedConnection.connectionGrant
        : null;
    let grantExpiresAt = Number(hostState.grantExpiresAt || storedConnection.grantExpiresAt) || null;
    let handoffId = typeof hostState.handoffId === "string" ? hostState.handoffId : null;
    let handoffExpiresAt = Number(hostState.handoffExpiresAt) || null;
    let handoffReceived = hostState.handoffReceived === true;
    let idempotencyKey = typeof plan.planId === "string" && plan.planId.length >= 8
      ? plan.planId
      : typeof hostState.idempotencyKey === "string" && hostState.idempotencyKey.length >= 8
        ? hostState.idempotencyKey
        : crypto.randomUUID();
    let statusTimer = null;
    let statusAttempts = 0;

    const applyTheme = (theme) => {
      const normalized = theme === "dark" || theme === "light" ? theme : "";
      if (normalized) document.documentElement.dataset.theme = normalized;
      else delete document.documentElement.dataset.theme;
    };
    applyTheme(window.openai?.theme);

    const now = Date.now();
    if (grantExpiresAt && grantExpiresAt <= now) {
      connectionGrant = null;
      grantExpiresAt = null;
      handoffId = null;
      handoffExpiresAt = null;
      handoffReceived = false;
      try { localStorage.removeItem(CONNECTION_STORAGE_KEY); } catch {}
    } else if (handoffExpiresAt && handoffExpiresAt <= now) {
      handoffId = null;
      handoffExpiresAt = null;
      handoffReceived = false;
      idempotencyKey = crypto.randomUUID();
    }

    const $ = (selector) => document.querySelector(selector);
    const escapeHtml = (value) => String(value ?? "").replace(/[&<>\"]/g, (character) => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[character]));
    const persistState = () => {
      if (window.openai?.setWidgetState) {
        window.openai.setWidgetState({
          version: STATE_VERSION,
          connectionGrant,
          grantExpiresAt,
          handoffId,
          handoffExpiresAt,
          handoffReceived,
          idempotencyKey,
        });
      }
      try {
        if (connectionGrant && grantExpiresAt && grantExpiresAt > Date.now()) {
          localStorage.setItem(CONNECTION_STORAGE_KEY, JSON.stringify({connectionGrant, grantExpiresAt}));
        } else {
          localStorage.removeItem(CONNECTION_STORAGE_KEY);
        }
      } catch {}
    };
    const setStatus = (message, tone = "") => {
      $("#status").textContent = message;
      $("#status").className = "status " + tone;
    };
    const normalizePairingCode = (value) => String(value ?? "")
      .normalize("NFKC")
      .replace(/[^0-9]/g, "")
      .slice(0, 6);
    const toolResult = (response) => response?.result || response;
    const toolMeta = (response) => {
      const result = toolResult(response);
      return result?._meta
        || response?.toolResponseMetadata?.mcp_tool_result?._meta
        || response?.mcp_tool_result?._meta
        || {};
    };
    const updateSendButton = () => {
      const hasItems = Boolean(plan.items?.length);
      $("#send").textContent = handoffReceived ? RECEIVED_LABEL : handoffId ? CHECK_LABEL : SEND_LABEL;
      $("#send").disabled = !connectionGrant || !hasItems || handoffReceived;
    };
    const setConnected = (connected) => {
      $("#connection").textContent = connected ? "연결됨" : "연결 안 됨";
      $("#connection").className = "connection" + (connected ? " connected" : "");
      $("#connectCard").hidden = connected;
      $("#disconnect").hidden = !connected;
      $("#pair").disabled = false;
      $("#pairing").disabled = false;
      updateSendButton();
    };
    const resetDelivery = () => {
      idempotencyKey = typeof plan.planId === "string" && plan.planId.length >= 8
        ? plan.planId
        : crypto.randomUUID();
      handoffId = null;
      handoffExpiresAt = null;
      handoffReceived = false;
      statusAttempts = 0;
      clearTimeout(statusTimer);
      $("#received").classList.remove("show");
      persistState();
      updateSendButton();
    };
    const summary = () => {
      const items = plan.items || [];
      $("#kinds").textContent = "상품 " + items.length + "종";
      $("#units").textContent = "실물 " + items.reduce((sum, item) => sum + Number(item.requestedPhysicalUnits || 0), 0) + "개";
      updateSendButton();
    };
    const field = (index, name, label, value) => value == null ? "" : '<label>' + label + '<input type="number" min="1" max="9999" data-index="' + index + '" data-field="' + name + '" value="' + escapeHtml(value) + '"></label>';
    const render = () => {
      const items = plan.items || [];
      summary();
      $("#items").innerHTML = items.map((item, index) => '<div class="item"><b>' + escapeHtml(item.productName || item.rawText) + '</b><div class="specs">' + field(index, "unitSizeValue", "용량", item.unitSizeValue) + field(index, "strengthValue", "함량", item.strengthValue) + field(index, "packageContentCount", "포장", item.packageContentCount) + field(index, "requestedPhysicalUnits", "수량", item.requestedPhysicalUnits) + '</div></div>').join("");
    };

    let rpcId = 0;
    const pendingRequests = new Map();
    const rpcNotify = (method, params = {}) => window.parent.postMessage({jsonrpc:"2.0", method, params}, "*");
    const rpcRequest = (method, params = {}, timeoutMs = 8000) => new Promise((resolve, reject) => {
      const id = ++rpcId;
      const timer = setTimeout(() => {
        pendingRequests.delete(id);
        reject(new Error("APP_BRIDGE_TIMEOUT"));
      }, timeoutMs);
      pendingRequests.set(id, {resolve, reject, timer});
      window.parent.postMessage({jsonrpc:"2.0", id, method, params}, "*");
    });
    const applyPlan = (candidate) => {
      if (!candidate || !Array.isArray(candidate.items)) return false;
      plan = candidate;
      resetDelivery();
      render();
      return true;
    };
    window.addEventListener("message", (event) => {
      if (event.source !== window.parent) return;
      const message = event.data;
      if (!message || message.jsonrpc !== "2.0") return;
      if (message.id != null) {
        const pending = pendingRequests.get(message.id);
        if (pending) {
          clearTimeout(pending.timer);
          pendingRequests.delete(message.id);
          if (message.error) pending.reject(new Error(message.error.message || "APP_BRIDGE_ERROR"));
          else pending.resolve(message.result);
        }
        return;
      }
      if (message.method === "ui/notifications/tool-result") {
        applyPlan(message.params?.structuredContent);
      }
    }, {passive:true});
    window.addEventListener("openai:set_globals", (event) => {
      const globals = event.detail?.globals;
      if (globals?.theme !== undefined) applyTheme(globals.theme);
      if (globals?.toolOutput !== undefined) applyPlan(globals.toolOutput);
    }, {passive:true});
    const initializeBridge = async () => {
      if (window.parent === window) return false;
      try {
        await rpcRequest("ui/initialize", {protocolVersion:"2026-01-26", appInfo:{name:"ddakdama", version:"1.0.0"}, capabilities:{}}, 1500);
        rpcNotify("ui/notifications/initialized");
        return true;
      } catch {
        return false;
      }
    };
    const bridgeReady = initializeBridge();
    const callTool = async (name, args) => {
      if (await bridgeReady) return rpcRequest("tools/call", {name, arguments:args});
      if (window.openai?.callTool) return window.openai.callTool(name, args);
      throw new Error("APP_BRIDGE_UNAVAILABLE");
    };

    const checkStatus = async (manual = false) => {
      if (!connectionGrant || !handoffId) return;
      try {
        const response = await callTool("get_cart_plan_status", {handoff_id:handoffId, connection_grant:connectionGrant});
        const result = response?.structuredContent || {};
        if (result.received) {
          handoffReceived = true;
          clearTimeout(statusTimer);
          $("#received").classList.add("show");
          setStatus("확장 프로그램이 목록을 받았습니다.", "success");
          persistState();
          updateSendButton();
          return;
        }
        if (!result.found || result.expired) {
          resetDelivery();
          setStatus("전송 기록이 만료되었습니다. 같은 목록을 다시 보내 주세요.", "error");
          return;
        }
        statusAttempts += 1;
        setStatus(manual ? "아직 수신 전입니다. 확장 프로그램에서 ‘GPT 앱에서 가져오기’를 눌러 주세요." : "전송 완료 · 확장 프로그램의 수신을 기다리는 중입니다.", "busy");
        if (statusAttempts < 12) statusTimer = setTimeout(() => checkStatus(false), 1500);
      } catch {
        setStatus("수신 상태를 확인하지 못했습니다. 잠시 후 다시 확인해 주세요.", "error");
      } finally {
        updateSendButton();
      }
    };

    $("#items").addEventListener("change", (event) => {
      const input = event.target;
      if (!(input instanceof HTMLInputElement)) return;
      const index = Number(input.dataset.index);
      const name = input.dataset.field;
      if (!plan.items?.[index] || !name) return;
      plan.items[index][name] = Math.max(1, Math.min(name === "requestedPhysicalUnits" ? 20 : 9999, Number(input.value) || 1));
      input.value = String(plan.items[index][name]);
      resetDelivery();
      summary();
      setStatus("수정한 목록을 보낼 준비가 됐습니다.");
    });
    $("#pairing").addEventListener("input", (event) => {
      event.target.value = normalizePairingCode(event.target.value);
    });
    $("#pairing").addEventListener("keydown", (event) => {
      if (event.key === "Enter") $("#pair").click();
    });
    $("#pair").onclick = async () => {
      const code = normalizePairingCode($("#pairing").value);
      $("#pairing").value = code;
      if (!/^[0-9]{6}$/.test(code)) {
        setStatus("6자리 연결 코드를 정확히 입력해 주세요.", "error");
        return;
      }
      $("#pair").disabled = true;
      $("#pairing").disabled = true;
      setStatus("확장 프로그램과 연결하는 중입니다.", "busy");
      try {
        const response = await callTool("pair_extension_device", {pairing_code:code});
        const result = toolResult(response);
        const meta = toolMeta(response);
        if (result?.isError || result?.structuredContent?.connected !== true) {
          throw new Error("PAIRING_REJECTED");
        }
        connectionGrant = meta.connectionGrant || null;
        grantExpiresAt = Number(meta.grantExpiresAt) || null;
        if (!connectionGrant) throw new Error("PAIRING_RESPONSE_INVALID");
        resetDelivery();
        persistState();
        setConnected(true);
        setStatus("연결됐습니다. 목록을 확장 프로그램으로 보낼 수 있습니다.", "success");
      } catch (error) {
        connectionGrant = null;
        grantExpiresAt = null;
        persistState();
        setConnected(false);
        const reason = error instanceof Error ? error.message : "";
        setStatus(
          reason.startsWith("APP_BRIDGE") || reason === "PAIRING_RESPONSE_INVALID"
            ? "ChatGPT 앱 연결 기능을 불러오지 못했습니다. 앱을 새로고침한 뒤 다시 시도해 주세요."
            : "코드가 만료됐거나 이미 사용됐습니다. 확장 프로그램에서 새 코드를 받아 다시 입력해 주세요.",
          "error",
        );
      }
    };
    const sendPlan = async () => {
      if (!connectionGrant || !plan.items?.length) return;
      // Once a handoff exists, this action is a true status query. It never resends.
      if (handoffId) {
        $("#send").disabled = true;
        setStatus("전송 상태를 확인하는 중입니다.", "busy");
        await checkStatus(true);
        return;
      }
      $("#send").disabled = true;
      setStatus("확장 프로그램으로 목록을 보내는 중입니다.", "busy");
      try {
        const response = await callTool("send_cart_plan", {items:plan.items, connection_grant:connectionGrant, idempotency_key:idempotencyKey});
        if (response?.isError || !response?.structuredContent?.sent) {
          if (response?.structuredContent?.message?.includes("만료")) {
            connectionGrant = null;
            grantExpiresAt = null;
            setConnected(false);
          }
          throw new Error("SEND_REJECTED");
        }
        handoffId = response?._meta?.handoffId || null;
        handoffExpiresAt = Number(response?._meta?.handoffExpiresAt) || null;
        handoffReceived = false;
        persistState();
        setStatus("전송했습니다. 확장 프로그램의 수신을 확인하는 중입니다.", "busy");
        if (handoffId) {
          statusAttempts = 0;
          await checkStatus(false);
        } else {
          setStatus("전송했습니다. 확장 프로그램에서 ‘GPT 앱에서 가져오기’를 눌러 주세요.", "success");
        }
      } catch {
        persistState();
        setStatus(connectionGrant ? "전송하지 못했습니다. 같은 요청으로 안전하게 다시 시도할 수 있습니다." : "연결이 만료됐습니다. 새 코드로 다시 연결해 주세요.", "error");
      } finally {
        updateSendButton();
      }
    };
    $("#send").onclick = () => void sendPlan();
    $("#disconnect").onclick = async () => {
      if (!connectionGrant) return;
      $("#disconnect").disabled = true;
      setStatus("연결을 해제하는 중입니다.", "busy");
      try {
        await callTool("disconnect_extension_device", {connection_grant:connectionGrant});
      } finally {
        connectionGrant = null;
        grantExpiresAt = null;
        resetDelivery();
        $("#pairing").value = "";
        $("#disconnect").disabled = false;
        setConnected(false);
        setStatus("연결을 해제했습니다. 다시 연결하려면 새 코드를 입력해 주세요.");
      }
    };

    persistState();
    setConnected(Boolean(connectionGrant));
    if (handoffReceived) {
      $("#received").classList.add("show");
      setStatus("확장 프로그램이 목록을 받았습니다.", "success");
    } else if (handoffId) {
      setStatus("이전 전송 상태를 복원했습니다. 수신 상태를 확인합니다.", "busy");
      void bridgeReady.then(() => checkStatus(false));
    }
    render();
    if (connectionGrant && plan.items?.length && !handoffId && !handoffReceived) {
      void bridgeReady.then(() => sendPlan());
    }
  </script>
</body>
</html>`;
