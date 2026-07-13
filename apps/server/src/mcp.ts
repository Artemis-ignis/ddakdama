import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  RESOURCE_MIME_TYPE,
  registerAppResource,
  registerAppTool,
} from "@modelcontextprotocol/ext-apps/server";
import { z } from "zod";
import {
  parseShoppingList,
  shoppingRequestLineSchema,
} from "@ddakdama/core";
import {
  authenticateGrant,
  completePairing,
  createHandoff,
  handoffStatus,
  normalizePairingCode,
  revokeConnectionGrant,
} from "./store.js";
import { WIDGET_URI, widgetHtml } from "./widget.js";

const itemSchema = shoppingRequestLineSchema;
const invocationMeta = (invoking: string, invoked: string) => ({
  "openai/toolInvocation/invoking": invoking,
  "openai/toolInvocation/invoked": invoked,
});

function parsePlan(shoppingList: string) {
  const items = parseShoppingList(shoppingList);
  return {
    items,
    itemKinds: items.length,
    physicalUnits: items.reduce(
      (sum, item) => sum + item.requestedPhysicalUnits,
      0,
    ),
  };
}

export function createMcpServer(
  { pairingClientKey = "unknown" }: { pairingClientKey?: string } = {},
) {
  const server = new McpServer(
    { name: "ddakdama", version: "1.0.0" },
    {
      instructions:
        "딱담아는 쇼핑 목록을 구조화하고, 사용자가 검토한 계획을 페어링된 Chrome 확장 프로그램으로 보냅니다. 실제 상품 검색, 가격 검증과 장바구니 추가는 확장 프로그램에서 사용자 승인 후 진행합니다. 단독 6자리 숫자나 3자리-3자리 숫자는 상품명이 아니라 확장 프로그램 연결 코드이므로 쇼핑 목록 도구에 전달하지 마세요.",
    },
  );

  registerAppResource(server, "ddakdama-widget", WIDGET_URI, {}, async () => ({
    contents: [
      {
        uri: WIDGET_URI,
        mimeType: RESOURCE_MIME_TYPE,
        text: widgetHtml,
        _meta: {
          ui: {
            prefersBorder: true,
            csp: { connectDomains: [], resourceDomains: [] },
          },
          "openai/widgetDescription":
            "쇼핑 목록의 규격과 수량을 확인하고 딱담아 확장 프로그램으로 보내는 화면입니다.",
          "openai/widgetPrefersBorder": true,
        },
      },
    ],
  }));

  // Data-only tool: it must not attach a widget template.
  registerAppTool(
    server,
    "parse_shopping_list",
    {
      title: "쇼핑 목록 분석",
      description:
        "사용자가 제품명이 포함된 여러 줄의 쇼핑 목록을 제품명, 규격, 함량과 요청 수량으로 구조화할 때 사용합니다. 단독 6자리 연결 코드는 쇼핑 목록으로 분석하지 마세요.",
      inputSchema: { shopping_list: z.string().min(1).max(20_000) },
      outputSchema: {
        items: z.array(itemSchema),
        itemKinds: z.number().int(),
        physicalUnits: z.number().int(),
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: false,
        idempotentHint: true,
      },
      _meta: invocationMeta("목록을 정확히 나누는 중…", "목록 확인 완료"),
    },
    async ({ shopping_list }) => {
      const output = parsePlan(shopping_list);
      return {
        structuredContent: output,
        content: [
          {
            type: "text",
            text: `상품 ${output.itemKinds}종, 실물 ${output.physicalUnits}개로 인식했습니다.`,
          },
        ],
      };
    },
  );

  // Render-only tool: this is the only tool that owns the widget resource URI.
  registerAppTool(
    server,
    "create_cart_plan",
    {
      title: "장바구니 계획 만들기",
      description:
        "제품명이 포함된 쇼핑 목록을 사용자가 위젯에서 검토하고 확장 프로그램으로 보낼 수 있도록 렌더링할 때 사용합니다. 단독 6자리 연결 코드는 이 도구에 전달하지 마세요.",
      inputSchema: { shopping_list: z.string().min(1).max(20_000) },
      outputSchema: {
        items: z.array(itemSchema),
        itemKinds: z.number().int(),
        physicalUnits: z.number().int(),
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: false,
        idempotentHint: true,
      },
      _meta: {
        ui: { resourceUri: WIDGET_URI },
        ...invocationMeta("장바구니 계획을 만드는 중…", "장바구니 계획 준비 완료"),
      },
    },
    async ({ shopping_list }) => ({
      structuredContent: parsePlan(shopping_list),
      content: [
        {
          type: "text",
          text: "딱담아 위젯에서 규격과 수량을 확인해 주세요.",
        },
      ],
    }),
  );

  registerAppTool(
    server,
    "pair_extension_device",
    {
      title: "확장 프로그램 연결",
      description:
        "사용자가 딱담아 확장 프로그램에 표시된 일회용 6자리 코드를 입력해 ChatGPT 앱과 연결할 때 사용합니다.",
      inputSchema: {
        pairing_code: z
          .string()
          .min(6)
          .max(9)
          .refine((value) => normalizePairingCode(value) !== null),
      },
      outputSchema: { connected: z.boolean() },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        openWorldHint: true,
        idempotentHint: false,
      },
      _meta: {
        ui: { visibility: ["app"] },
        ...invocationMeta("확장 프로그램과 연결하는 중…", "연결 확인 완료"),
      },
    },
    async ({ pairing_code }) => {
      const paired = completePairing(pairing_code, pairingClientKey);
      if (!paired) {
        return {
          isError: true,
          structuredContent: { connected: false },
          content: [
            {
              type: "text",
              text: "페어링 코드가 만료됐거나 이미 사용됐습니다. 확장 프로그램에서 새 코드를 확인해 주세요.",
            },
          ],
        };
      }
      return {
        structuredContent: { connected: true },
        content: [
          { type: "text", text: "딱담아 확장 프로그램과 연결했습니다." },
        ],
        _meta: {
          connectionGrant: paired.connectionGrant,
          grantExpiresAt: paired.expiresAt,
        },
      };
    },
  );

  registerAppTool(
    server,
    "send_cart_plan",
    {
      title: "딱담아로 보내기",
      description:
        "사용자가 확인한 장바구니 계획을 연결된 딱담아 확장 프로그램으로 전송할 때 사용합니다. 동일한 idempotency_key 재시도는 중복 계획을 만들지 않습니다.",
      inputSchema: {
        items: z.array(itemSchema).min(1).max(50),
        connection_grant: z.string().min(32),
        idempotency_key: z.string().min(8).max(128),
      },
      outputSchema: { sent: z.boolean(), message: z.string() },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        openWorldHint: true,
        idempotentHint: true,
      },
      _meta: {
        ui: { visibility: ["app"] },
        ...invocationMeta("딱담아로 보내는 중…", "전송 완료"),
      },
    },
    async ({ items, connection_grant, idempotency_key }) => {
      const deviceId = authenticateGrant(connection_grant);
      if (!deviceId) {
        return {
          isError: true,
          structuredContent: {
            sent: false,
            message: "확장 프로그램 연결이 만료되었습니다.",
          },
          content: [
            { type: "text", text: "확장 프로그램을 다시 연결해 주세요." },
          ],
        };
      }
      const handoff = createHandoff(
        deviceId,
        { items },
        idempotency_key,
      );
      return {
        structuredContent: {
          sent: true,
          message: "확장 프로그램으로 보냈습니다.",
        },
        content: [
          {
            type: "text",
            text: "딱담아 확장 프로그램에서 상품과 가격을 확인해 주세요.",
          },
        ],
        _meta: {
          handoffId: handoff.id,
          handoffExpiresAt: handoff.expiresAt,
        },
      };
    },
  );

  registerAppTool(
    server,
    "get_cart_plan_status",
    {
      title: "전송 상태 확인",
      description:
        "확장 프로그램이 장바구니 계획을 받았는지 확인할 때 사용합니다.",
      inputSchema: {
        handoff_id: z.string().uuid(),
        connection_grant: z.string().min(32),
      },
      outputSchema: {
        found: z.boolean(),
        received: z.boolean().optional(),
        expired: z.boolean().optional(),
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: false,
        idempotentHint: true,
      },
      _meta: { ui: { visibility: ["app"] } },
    },
    async ({ handoff_id, connection_grant }) => {
      const deviceId = authenticateGrant(connection_grant);
      const status = deviceId ? handoffStatus(deviceId, handoff_id) : null;
      return {
        structuredContent: status ? { found: true, ...status } : { found: false },
        content: [
          {
            type: "text",
            text: status
              ? status.received
                ? "확장 프로그램이 계획을 받았습니다."
                : "아직 확장 프로그램이 받지 않았습니다."
              : "전송 기록을 찾지 못했습니다.",
          },
        ],
      };
    },
  );

  registerAppTool(
    server,
    "disconnect_extension_device",
    {
      title: "확장 프로그램 연결 해제",
      description:
        "현재 ChatGPT 앱과 연결된 딱담아 확장 프로그램의 연결을 해제합니다.",
      inputSchema: { connection_grant: z.string().min(32) },
      outputSchema: { disconnected: z.boolean() },
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        openWorldHint: true,
        idempotentHint: true,
      },
      _meta: { ui: { visibility: ["app"] } },
    },
    async ({ connection_grant }) => {
      const disconnected = revokeConnectionGrant(connection_grant);
      return {
        structuredContent: { disconnected },
        content: [
          {
            type: "text",
            text: disconnected
              ? "딱담아 확장 프로그램 연결을 해제했습니다."
              : "이미 연결이 해제됐거나 만료되었습니다.",
          },
        ],
      };
    },
  );

  registerAppTool(
    server,
    "get_service_status",
    {
      title: "딱담아 상태 확인",
      description: "딱담아 서비스를 현재 사용할 수 있는지 확인할 때 사용합니다.",
      inputSchema: {},
      outputSchema: {
        status: z.enum(["available", "degraded", "unavailable"]),
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: false,
        idempotentHint: true,
      },
      _meta: {},
    },
    async () => ({
      structuredContent: { status: "available" as const },
      content: [{ type: "text", text: "딱담아를 사용할 수 있습니다." }],
    }),
  );

  return server;
}
