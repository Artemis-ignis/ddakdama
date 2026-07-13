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

const paired = await client.callTool({
  name: "pair_extension_device",
  arguments: {pairing_code: pairing.code},
});
const shoppingList = "스킨1004 히알루 시카 워터핏 선 세럼 50ml 2개";
const parsed = await client.callTool({
  name: "parse_shopping_list",
  arguments: {shopping_list: shoppingList},
});
const sent = await client.callTool({
  name: "send_cart_plan",
  arguments: {
    items: parsed.structuredContent.items,
    connection_grant: paired._meta.connectionGrant,
    idempotency_key: `runtime-smoke-${Date.now()}`,
  },
});
const latest = await fetch(`${origin}/api/handoffs/latest`, {
  headers: {authorization: `Bearer ${pairing.deviceToken}`},
}).then((response) => response.json());
if (!latest.handoff) throw new Error("HANDOFF_NOT_RECEIVED");
const ack = await fetch(`${origin}/api/handoffs/${latest.handoff.id}/ack`, {
  method: "POST",
  headers: {authorization: `Bearer ${pairing.deviceToken}`},
});
const status = await client.callTool({
  name: "get_cart_plan_status",
  arguments: {handoff_id: latest.handoff.id, connection_grant: paired._meta.connectionGrant},
});

console.log(JSON.stringify({
  paired: paired.structuredContent,
  sent: sent.structuredContent,
  receivedRaw: latest.handoff.payload.items[0].rawText,
  ack: ack.status,
  status: status.structuredContent,
}));
await client.close();
