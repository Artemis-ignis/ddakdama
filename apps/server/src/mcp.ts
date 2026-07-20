import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  RESOURCE_MIME_TYPE,
  registerAppResource,
  registerAppTool,
} from "@modelcontextprotocol/ext-apps/server";
import { z } from "zod";
import {
  parseShoppingLine,
  parseShoppingList,
  shoppingRequestLineSchema,
} from "@ddakdama/core";

type MaybePromise<T> = T | Promise<T>;

export type McpStore = {
  completePairing: (
    code: string,
    clientKey?: string,
    pairingNonce?: string,
  ) => MaybePromise<{ connectionGrant: string; expiresAt: number } | null>;
  authenticateGrant: (grant: string) => MaybePromise<string | null>;
  createHandoff: (
    deviceId: string,
    payload: unknown,
    idempotencyKey: string,
  ) => MaybePromise<{ id: string; expiresAt: number }>;
  handoffStatus: (
    deviceId: string,
    id: string,
  ) => MaybePromise<{ received: boolean; expired: boolean } | null>;
  revokeConnectionGrant: (grant: string) => MaybePromise<boolean>;
};

export type McpServerOptions = {
  pairingClientKey?: string;
  store: McpStore;
  widgetHtml: string;
  widgetUri: string;
  legacyWidgetUris?: readonly string[];
  widgetConnectDomains?: string[];
  widgetResourceDomains?: string[];
  widgetDomain?: string;
};

const normalizePairingCode = (value: string) => {
  const compact = value.normalize("NFKC").replace(/[\s-]+/g, "");
  return /^\d{6}$/.test(compact) ? compact : null;
};

const itemSchema = shoppingRequestLineSchema;
/**
 * ChatGPT widget hosts may send only the editable fields instead of a full
 * ShoppingRequestLine. Raw text remains the canonical user intent.
 */
const handoffItemSchema = z.object({
  rawText: z.string().min(1).max(500),
  brand: z.string().max(100).nullable().optional(),
  unitSizeValue: z.number().positive().max(100_000).nullable().optional(),
  unitSizeUnit: z.enum(["mL", "L", "g", "kg"]).nullable().optional(),
  strengthValue: z.number().positive().max(100_000).nullable().optional(),
  strengthUnit: z.enum(["mg", "mcg", "IU", "%"]).nullable().optional(),
  packageContentCount: z.number().int().positive().max(10_000).nullable().optional(),
  packageContentUnit: z.string().min(1).max(20).nullable().optional(),
  requestedPhysicalUnits: z.number().int().positive().max(10_000).optional(),
  requestedPurchaseUnits: z.number().int().positive().max(10_000).optional(),
}).passthrough();
const shoppingListInput = z.string().min(1).max(20_000).describe(
  "Create one exact, purchasable product choice per line. For a generic request such as 'summer snacks 10 items', choose a concrete product family and a single target package; never emit ranges (for example 70~100mL), alternatives (A or B), 'around', or ambiguous total-serving wording. Keep product identity, per-unit size, package count, and requested purchase quantity separate. Convert total servings to packages (for example: 'cold noodles 2 servings, total 4 servings' becomes 'cold noodles 2 servings 2 packs'). Use search-ready lines such as 'water 1L 12 bottles 1 pack', 'bibim noodles 130g 5-pack 1 pack', or 'frozen chicken tenders 1kg 1 bag'.",
);
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

/**
 * The original list line is the source of truth for product identity.  A
 * widget is allowed to adjust quantities, but a projected host payload must
 * never turn a name into a visible spec such as `70mL` before a browser
 * searches for it.
 */
export function normalizeHandoffItems(items: unknown[]) {
  return items.map((value, index) => {
    const incoming = handoffItemSchema.parse(value);
    const parsed = parseShoppingLine(incoming.rawText, index);
    const identity = parsed.productName.replace(/[\d\s.~x×]/gu, "").trim();
    if (!identity) {
      throw new Error("INVALID_HANDOFF_PRODUCT_NAME");
    }
    return shoppingRequestLineSchema.parse({
      ...parsed,
      brand: incoming.brand ?? parsed.brand,
      unitSizeValue: incoming.unitSizeValue ?? parsed.unitSizeValue,
      unitSizeUnit: incoming.unitSizeUnit ?? parsed.unitSizeUnit,
      strengthValue: incoming.strengthValue ?? parsed.strengthValue,
      strengthUnit: incoming.strengthUnit ?? parsed.strengthUnit,
      packageContentCount: incoming.packageContentCount ?? parsed.packageContentCount,
      packageContentUnit: incoming.packageContentUnit ?? parsed.packageContentUnit,
      requestedPhysicalUnits: incoming.requestedPhysicalUnits ?? parsed.requestedPhysicalUnits,
      requestedPurchaseUnits: incoming.requestedPurchaseUnits ?? parsed.requestedPurchaseUnits,
    });
  });
}

export function createMcpServer({
  pairingClientKey = "unknown",
  store,
  widgetHtml,
  widgetUri,
  legacyWidgetUris = [],
  widgetConnectDomains = [],
  widgetResourceDomains = [],
  widgetDomain,
}: McpServerOptions) {
  const server = new McpServer(
    { name: "ddakdama", version: "1.0.0" },
    {
      instructions:
        "딱담아는 쇼핑 목록을 구조화하고, 사용자가 검토한 계획을 페어링된 Chrome 확장 프로그램으로 보냅니다. 실제 상품 검색, 가격 검증과 장바구니 추가는 확장 프로그램에서 사용자 승인 후 진행합니다. 특히 사용자가 '여름 간식 10개 담아줘'처럼 포괄적으로 요청하면, 범위·대체안·내외를 포함한 조건문을 만들지 말고 검색 가능한 구체 상품과 단일 규격을 하나씩 정해 한 줄에 하나의 실제 구매 단위로 작성하세요. 상품명·1개 기준 규격·포장 구성·필요 수량을 분리하세요. '총 4인분'처럼 총량만 있으면 구매 가능한 포장 단위로 환산하세요(예: 2인분 구성 총 4인분 → 2인분 2봉). 'A 또는 B'는 하나의 검색어로 넘기지 말고 대표 상품 하나를 정하세요. 단독 6자리 숫자나 3자리-3자리 숫자는 상품명이 아니라 확장 프로그램 연결 코드이므로 쇼핑 목록 도구에 전달하지 마세요.",
    },
  );

  const registeredWidgetUris = [...new Set([widgetUri, ...legacyWidgetUris])];
  for (const [index, resourceUri] of registeredWidgetUris.entries()) {
    registerAppResource(
      server,
      index === 0 ? "ddakdama-widget" : `ddakdama-widget-legacy-${index}`,
      resourceUri,
      {},
      async () => ({
        contents: [
          {
            uri: resourceUri,
            mimeType: RESOURCE_MIME_TYPE,
            text: widgetHtml,
            _meta: {
              ui: {
                prefersBorder: true,
                ...(widgetDomain ? { domain: widgetDomain } : {}),
                csp: {
                  connectDomains: widgetConnectDomains,
                  resourceDomains: widgetResourceDomains,
                },
              },
              "openai/widgetDescription":
                "쇼핑 목록의 규격과 수량을 확인하고 딱담아 확장 프로그램으로 보내는 화면입니다.",
              ...(widgetDomain ? { "openai/widgetDomain": widgetDomain } : {}),
              "openai/widgetPrefersBorder": true,
            },
          },
        ],
      }),
    );
  }

  // Data-only tool: it must not attach a widget template.
  registerAppTool(
    server,
    "parse_shopping_list",
    {
      title: "쇼핑 목록 분석",
      description:
        "사용자가 제품명이 포함된 여러 줄의 쇼핑 목록을 제품명, 규격, 함량과 요청 수량으로 구조화할 때 사용합니다. 단독 6자리 연결 코드는 쇼핑 목록으로 분석하지 마세요.",
      inputSchema: { shopping_list: shoppingListInput },
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
      inputSchema: { shopping_list: shoppingListInput },
      outputSchema: {
        items: z.array(itemSchema),
        itemKinds: z.number().int(),
        physicalUnits: z.number().int(),
        planId: z.string().uuid(),
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: false,
        idempotentHint: true,
      },
      _meta: {
        ui: { resourceUri: widgetUri },
        "openai/outputTemplate": widgetUri,
        ...invocationMeta("장바구니 계획을 만드는 중…", "장바구니 계획 준비 완료"),
      },
    },
    async ({ shopping_list }) => ({
      structuredContent: {
        ...parsePlan(shopping_list),
        planId: crypto.randomUUID(),
      },
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
        pairing_nonce: z.string().uuid().optional(),
      },
      outputSchema: { connected: z.boolean() },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        openWorldHint: true,
        idempotentHint: true,
      },
      _meta: {
        ui: { visibility: ["app"] },
        ...invocationMeta("확장 프로그램과 연결하는 중…", "연결 확인 완료"),
      },
    },
    async ({ pairing_code, pairing_nonce }) => {
      const paired = await store.completePairing(
        pairing_code,
        pairingClientKey,
        pairing_nonce,
      );
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
        items: z.array(handoffItemSchema).min(1).max(50),
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
      let normalizedItems: ReturnType<typeof normalizeHandoffItems>;
      try {
        normalizedItems = normalizeHandoffItems(items);
      } catch {
        return {
          isError: true,
          structuredContent: {
            sent: false,
            message: "상품명을 복구하지 못했습니다. 목록을 다시 만들거나 상품명을 확인해 주세요.",
          },
          content: [
            { type: "text", text: "상품명 또는 규격을 안전하게 확인하지 못해 확장 프로그램으로 보내지 않았습니다." },
          ],
        };
      }
      const deviceId = await store.authenticateGrant(connection_grant);
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
      const handoff = await store.createHandoff(
        deviceId,
        { items: normalizedItems },
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
      const deviceId = await store.authenticateGrant(connection_grant);
      const status = deviceId
        ? await store.handoffStatus(deviceId, handoff_id)
        : null;
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
      const disconnected = await store.revokeConnectionGrant(connection_grant);
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
