import {Client} from "@modelcontextprotocol/sdk/client/index.js";
import {StreamableHTTPClientTransport} from "@modelcontextprotocol/sdk/client/streamableHttp.js";

const origin = (
  process.argv[2] ??
  process.env.DDAKDAMA_TEST_ORIGIN ??
  "http://localhost:8787"
)
  .replace(/\/mcp\/?$/, "")
  .replace(/\/$/, "");
const expectedWidgetUri = "ui://widget/ddakdama-cart-v13.html";
const legacyWidgetUris = ["ui://widget/ddakdama-cart-v12.html", "ui://widget/ddakdama-cart-v11.html", "ui://widget/ddakdama-cart-v10.html", "ui://widget/ddakdama-cart-v9.html", "ui://widget/ddakdama-cart-v8.html", "ui://widget/ddakdama-cart-v7.html", "ui://widget/ddakdama-cart-v6.html", "ui://widget/ddakdama-cart-v5.html"];
const pairing = await fetch(`${origin}/api/pairing/start`, {
  method: "POST",
  headers: {"content-type": "application/json"},
  body: JSON.stringify({}),
}).then((response) => response.json());
const pendingPairingStatus = await fetch(`${origin}/api/pairing/status`, {
  headers: {authorization: `Bearer ${pairing.deviceToken}`},
}).then((response) => response.json());
if (pendingPairingStatus.connected !== false) {
  throw new Error("UNPAIRED_DEVICE_REPORTED_CONNECTED");
}

const client = new Client({name: "ddakdama-smoke", version: "1.0.0"});
await client.connect(new StreamableHTTPClientTransport(new URL(`${origin}/mcp`)));

const tools = await client.listTools();
const cartPlanTool = tools.tools.find((tool) => tool.name === "create_cart_plan");
if (cartPlanTool?._meta?.ui?.resourceUri !== expectedWidgetUri) {
  throw new Error(`STALE_WIDGET_URI:${String(cartPlanTool?._meta?.ui?.resourceUri)}`);
}
const widgetResource = await client.readResource({uri: expectedWidgetUri});
const widgetText = widgetResource.contents.find((content) => "text" in content)?.text ?? "";
for (const legacyWidgetUri of legacyWidgetUris) {
  const legacyResource = await client.readResource({uri: legacyWidgetUri});
  const legacyText = legacyResource.contents.find((content) => "text" in content)?.text ?? "";
  if (legacyText !== widgetText) {
    throw new Error(`LEGACY_WIDGET_MISMATCH:${legacyWidgetUri}`);
  }
}
if (!widgetText.includes('src="data:image/png;base64,')) throw new Error("WIDGET_ICON_MISSING");
if (widgetText.includes('maxlength="6"') || !widgetText.includes("/^[0-9]{6}$/")) {
  throw new Error("PAIRING_INPUT_FIX_MISSING");
}
if (!widgetText.includes('window.addEventListener("openai:set_globals"') ||
    widgetText.indexOf('window.addEventListener("message"') > widgetText.indexOf("const bridgeReady = initializeBridge()")) {
  throw new Error("INITIAL_TOOL_RESULT_HYDRATION_MISSING");
}
const widgetTools = tools.tools
  .filter((tool) => tool._meta?.ui?.resourceUri)
  .map((tool) => tool.name);
if (JSON.stringify(widgetTools) !== JSON.stringify(["create_cart_plan"])) {
  throw new Error(`WIDGET_TOOL_CONTRACT_VIOLATION:${widgetTools.join(",")}`);
}
const appOnlyTools = tools.tools
  .filter((tool) => tool._meta?.ui?.visibility?.includes("app"))
  .map((tool) => tool.name)
  .sort();
const expectedAppOnlyTools = ["disconnect_extension_device", "get_cart_plan_status", "pair_extension_device", "send_cart_plan"];
if (JSON.stringify(appOnlyTools) !== JSON.stringify(expectedAppOnlyTools)) {
  throw new Error(`APP_ONLY_TOOL_CONTRACT_VIOLATION:${appOnlyTools.join(",")}`);
}

const pairingNonce = crypto.randomUUID();
const pairingArguments = {
  pairing_code: `${pairing.code.slice(0, 3)} ${pairing.code.slice(3)}`,
  pairing_nonce: pairingNonce,
};
const paired = await client.callTool({
  name: "pair_extension_device",
  arguments: pairingArguments,
});
const pairedRetry = await client.callTool({
  name: "pair_extension_device",
  arguments: pairingArguments,
});
if (!paired._meta?.connectionGrant || pairedRetry._meta?.connectionGrant !== paired._meta.connectionGrant) {
  throw new Error("PAIRING_RETRY_NOT_IDEMPOTENT");
}
const connectedPairingStatus = await fetch(`${origin}/api/pairing/status`, {
  headers: {authorization: `Bearer ${pairing.deviceToken}`},
}).then((response) => response.json());
if (connectedPairingStatus.connected !== true || !Number.isFinite(connectedPairingStatus.grantExpiresAt)) {
  throw new Error("PAIRED_DEVICE_NOT_REPORTED_CONNECTED");
}
const shoppingList = [
  "닥터지 레드 블레미쉬 포 맨 진정 올인원 150ml",
  "스킨1004 히알루 시카 워터핏 선 세럼 50ml 2개",
  "라운드랩 1025 독도 클렌저 150ml 2개",
  "TS 골드플러스 샴푸 500g",
  "닥터스베스트 고흡수 마그네슘 100mg 240정",
].join("\n");
const parsed = await client.callTool({
  name: "parse_shopping_list",
  arguments: {shopping_list: shoppingList},
});
const parsedItems = parsed.structuredContent.items;
const physicalUnits = parsedItems.reduce(
  (sum, item) => sum + item.requestedPhysicalUnits,
  0,
);
if (parsedItems.length !== 5 || physicalUnits !== 7) {
  throw new Error(`FIXTURE_PARSE_MISMATCH:${parsedItems.length}/${physicalUnits}`);
}
if (
  parsedItems[4].strengthValue !== 100 ||
  parsedItems[4].strengthUnit !== "mg" ||
  parsedItems[4].packageContentCount !== 240 ||
  parsedItems[4].packageContentUnit !== "정" ||
  parsedItems[4].requestedPhysicalUnits !== 1
) {
  throw new Error("MAGNESIUM_PARSE_MISMATCH");
}
const idempotencyKey = `runtime-smoke-${Date.now()}`;
const sendArguments = {
  items: parsedItems,
  connection_grant: paired._meta.connectionGrant,
  idempotency_key: idempotencyKey,
};
const sent = await client.callTool({
  name: "send_cart_plan",
  arguments: sendArguments,
});
const retried = await client.callTool({
  name: "send_cart_plan",
  arguments: sendArguments,
});
if (!sent._meta?.handoffId || sent._meta.handoffId !== retried._meta?.handoffId) throw new Error("SEND_NOT_IDEMPOTENT");
if ("handoffId" in sent.structuredContent) throw new Error("INTERNAL_ID_EXPOSED");
const latest = await fetch(`${origin}/api/handoffs/latest`, {
  headers: {authorization: `Bearer ${pairing.deviceToken}`},
}).then((response) => response.json());
if (!latest.handoff) throw new Error("HANDOFF_NOT_RECEIVED");
if (latest.handoff.id !== sent._meta.handoffId) throw new Error("LATEST_HANDOFF_MISMATCH");
const ack = await fetch(`${origin}/api/handoffs/${latest.handoff.id}/ack`, {
  method: "POST",
  headers: {authorization: `Bearer ${pairing.deviceToken}`},
});
const missingAck = await fetch(`${origin}/api/handoffs/${crypto.randomUUID()}/ack`, {
  method: "POST",
  headers: {authorization: `Bearer ${pairing.deviceToken}`},
});
const missingAckBody = await missingAck.json();
if (missingAck.status !== 404 || missingAckBody.ok !== false) {
  throw new Error("MISSING_ACK_CONTRACT_VIOLATION");
}
const status = await client.callTool({
  name: "get_cart_plan_status",
  arguments: {handoff_id: sent._meta.handoffId, connection_grant: paired._meta.connectionGrant},
});

// A widget projection can contain a display fragment (for example, "70mL")
// in productName. The server must rebuild the real search identity from the
// original line before the extension receives it.
const rawOnly = await client.callTool({
  name: "send_cart_plan",
  arguments: {
    items: [
      {
        rawText: "제로 아이스크림 바 70~100ml × 10개, 1세트",
        productName: "70mL",
      },
    ],
    connection_grant: paired._meta.connectionGrant,
    idempotency_key: `raw-only-${Date.now()}`,
  },
});
const rawOnlyLatest = await fetch(`${origin}/api/handoffs/latest`, {
  headers: {authorization: `Bearer ${pairing.deviceToken}`},
}).then(async (response) => {
  if (!response.ok) throw new Error(`RAW_ONLY_LATEST_FAILED:${response.status}`);
  return response.json();
});
const rawOnlyItem = rawOnlyLatest.handoff?.payload?.items?.[0];
if (
  rawOnlyItem?.productName !== "제로 아이스크림 바" ||
  rawOnlyItem?.requestedPhysicalUnits !== 10
) {
  throw new Error(`RAW_ONLY_NORMALIZATION_FAILED:${JSON.stringify(rawOnlyItem)}`);
}
const disconnected = await client.callTool({
  name: "disconnect_extension_device",
  arguments: {connection_grant: paired._meta.connectionGrant},
});
const revokedDeviceResponse = await fetch(`${origin}/api/handoffs/latest`, {
  headers: {authorization: `Bearer ${pairing.deviceToken}`},
});
if (revokedDeviceResponse.status !== 401) throw new Error("DEVICE_TOKEN_NOT_REVOKED");
const revokedStatusResponse = await fetch(`${origin}/api/pairing/status`, {
  headers: {authorization: `Bearer ${pairing.deviceToken}`},
});
if (revokedStatusResponse.status !== 401) throw new Error("REVOKED_PAIRING_STATUS_AUTHORIZED");

console.log(JSON.stringify({
  paired: paired.structuredContent,
  sent: sent.structuredContent,
  receivedKinds: latest.handoff.payload.items.length,
  receivedPhysicalUnits: latest.handoff.payload.items.reduce(
    (sum, item) => sum + item.requestedPhysicalUnits,
    0,
  ),
  ack: ack.status,
  missingAck: {status: missingAck.status, body: missingAckBody},
  status: status.structuredContent,
  rawOnly: {
    sent: rawOnly.structuredContent?.sent,
    productName: rawOnlyItem.productName,
    requestedPhysicalUnits: rawOnlyItem.requestedPhysicalUnits,
  },
  disconnected: disconnected.structuredContent,
  revokedDeviceStatus: revokedDeviceResponse.status,
  pairingStatus: {
    before: pendingPairingStatus,
    after: connectedPairingStatus,
    revoked: revokedStatusResponse.status,
  },
}));
await client.close();
