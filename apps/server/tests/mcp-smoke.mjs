import {Client} from "@modelcontextprotocol/sdk/client/index.js";
import {StreamableHTTPClientTransport} from "@modelcontextprotocol/sdk/client/streamableHttp.js";

const origin = process.env.DDAKDAMA_TEST_ORIGIN ?? "http://localhost:8787";
const pairing = await fetch(`${origin}/api/pairing/start`, {
  method: "POST",
  headers: {"content-type": "application/json"},
  body: JSON.stringify({}),
}).then((response) => response.json());

const client = new Client({name: "ddakdama-smoke", version: "1.0.0"});
await client.connect(new StreamableHTTPClientTransport(new URL(`${origin}/mcp`)));

const tools = await client.listTools();
const widgetTools = tools.tools
  .filter((tool) => tool._meta?.ui?.resourceUri)
  .map((tool) => tool.name);
if (JSON.stringify(widgetTools) !== JSON.stringify(["create_cart_plan"])) {
  throw new Error(`WIDGET_TOOL_CONTRACT_VIOLATION:${widgetTools.join(",")}`);
}

const paired = await client.callTool({
  name: "pair_extension_device",
  arguments: {pairing_code: pairing.code},
});
const shoppingList = "스킨1004 히알루 시카 워터핏 선 세럼 50ml 2개";
const parsed = await client.callTool({
  name: "parse_shopping_list",
  arguments: {shopping_list: shoppingList},
});
const idempotencyKey = `runtime-smoke-${Date.now()}`;
const sendArguments = {
  items: parsed.structuredContent.items,
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
const disconnected = await client.callTool({
  name: "disconnect_extension_device",
  arguments: {connection_grant: paired._meta.connectionGrant},
});
const revokedDeviceResponse = await fetch(`${origin}/api/handoffs/latest`, {
  headers: {authorization: `Bearer ${pairing.deviceToken}`},
});
if (revokedDeviceResponse.status !== 401) throw new Error("DEVICE_TOKEN_NOT_REVOKED");

console.log(JSON.stringify({
  paired: paired.structuredContent,
  sent: sent.structuredContent,
  receivedRaw: latest.handoff.payload.items[0].rawText,
  ack: ack.status,
  missingAck: {status: missingAck.status, body: missingAckBody},
  status: status.structuredContent,
  disconnected: disconnected.structuredContent,
  revokedDeviceStatus: revokedDeviceResponse.status,
}));
await client.close();
