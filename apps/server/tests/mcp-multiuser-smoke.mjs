import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

const origin = process.env.DDAKDAMA_TEST_ORIGIN ?? "http://127.0.0.1:8790";
const fixture = [
  "닥터지 레드 블레미쉬 포 맨 진정 올인원 150ml",
  "스킨1004 히알루 시카 워터핏 선 세럼 50ml 2개",
  "라운드랩 1025 독도 클렌저 150ml 2개",
  "TS 골드플러스 샴푸 500g",
  "닥터스베스트 고흡수 마그네슘 100mg 240정",
].join("\n");

const startPairing = () =>
  fetch(`${origin}/api/pairing/start`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: "{}",
  }).then(async (response) => {
    if (!response.ok) throw new Error(`PAIRING_START_${response.status}`);
    return response.json();
  });

const createClient = async (name) => {
  const client = new Client({ name, version: "1.0.0" });
  await client.connect(
    new StreamableHTTPClientTransport(new URL(`${origin}/mcp`)),
  );
  return client;
};

const latest = async (token) => {
  const response = await fetch(`${origin}/api/handoffs/latest`, {
    headers: { authorization: `Bearer ${token}` },
  });
  if (!response.ok) throw new Error(`LATEST_${response.status}`);
  return response.json();
};

const [pairingA, pairingB] = await Promise.all([startPairing(), startPairing()]);
const [clientA, clientB] = await Promise.all([
  createClient("ddakdama-multi-a"),
  createClient("ddakdama-multi-b"),
]);

try {
  const [grantA, grantB] = await Promise.all([
    clientA.callTool({
      name: "pair_extension_device",
      arguments: { pairing_code: pairingA.code },
    }),
    clientB.callTool({
      name: "pair_extension_device",
      arguments: { pairing_code: pairingB.code },
    }),
  ]);
  if (!grantA._meta?.connectionGrant || !grantB._meta?.connectionGrant) {
    throw new Error("PAIRING_GRANT_MISSING");
  }

  const parsedA = await clientA.callTool({
    name: "parse_shopping_list",
    arguments: { shopping_list: fixture },
  });
  const parsedB = await clientB.callTool({
    name: "parse_shopping_list",
    arguments: { shopping_list: "삼다수 2L 3개" },
  });

  await Promise.all([
    clientA.callTool({
      name: "send_cart_plan",
      arguments: {
        items: parsedA.structuredContent.items,
        connection_grant: grantA._meta.connectionGrant,
        idempotency_key: `multi-a-${Date.now()}`,
      },
    }),
    clientB.callTool({
      name: "send_cart_plan",
      arguments: {
        items: parsedB.structuredContent.items,
        connection_grant: grantB._meta.connectionGrant,
        idempotency_key: `multi-b-${Date.now()}`,
      },
    }),
  ]);

  const [receivedA, receivedB] = await Promise.all([
    latest(pairingA.deviceToken),
    latest(pairingB.deviceToken),
  ]);
  const itemsA = receivedA.handoff?.payload?.items ?? [];
  const itemsB = receivedB.handoff?.payload?.items ?? [];
  const unitsA = itemsA.reduce(
    (sum, item) => sum + item.requestedPhysicalUnits,
    0,
  );
  const unitsB = itemsB.reduce(
    (sum, item) => sum + item.requestedPhysicalUnits,
    0,
  );
  if (itemsA.length !== 5 || unitsA !== 7) {
    throw new Error(`USER_A_MISMATCH:${itemsA.length}/${unitsA}`);
  }
  if (itemsB.length !== 1 || unitsB !== 3) {
    throw new Error(`USER_B_MISMATCH:${itemsB.length}/${unitsB}`);
  }
  if (itemsA.some((item) => item.rawText.includes("삼다수"))) {
    throw new Error("CROSS_USER_LEAK_A");
  }
  if (itemsB.some((item) => item.rawText.includes("닥터지"))) {
    throw new Error("CROSS_USER_LEAK_B");
  }

  console.log(
    JSON.stringify({
      users: 2,
      userA: { itemKinds: itemsA.length, physicalUnits: unitsA },
      userB: { itemKinds: itemsB.length, physicalUnits: unitsB },
      isolated: true,
    }),
  );
} finally {
  await Promise.allSettled([clientA.close(), clientB.close()]);
}
