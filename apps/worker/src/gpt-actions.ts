import { z } from "zod";

export const gptShoppingItemInputSchema = z.object({
  productName: z.string().trim().min(1).max(200),
  specification: z.string().trim().min(1).max(200).optional(),
  quantity: z.string().trim().min(1).max(100).optional(),
});

export const gptShoppingContextInputSchema = z.object({
  goal: z.string().trim().min(1).max(300).optional(),
  budgetWon: z.number().int().positive().max(100_000_000).optional(),
  notes: z.array(z.string().trim().min(1).max(300)).max(10).optional(),
}).optional();

const gptPlanFields = {
  items: z.array(gptShoppingItemInputSchema).min(1).max(50).optional(),
  /** Backward compatibility for the first public GPT schema. */
  shoppingList: z.string().trim().min(1).max(20_000).optional(),
  context: gptShoppingContextInputSchema,
  consentToStoreRaw: z.boolean().optional(),
};

const requireItemsOrLegacyList = (
  value: { items?: unknown[]; shoppingList?: string },
  context: z.RefinementCtx,
) => {
  if (!value.items?.length && !value.shoppingList?.trim()) {
    context.addIssue({
      code: "custom",
      message: "구체적인 구매 상품을 items 배열에 한 개 이상 넣어 주세요.",
      path: ["items"],
    });
  }
};

export const gptPlanCreateInputSchema = z.object(gptPlanFields)
  .strict()
  .superRefine(requireItemsOrLegacyList);

export const gptPlanReplaceInputSchema = z.object({
  ...gptPlanFields,
  planUrl: z.string().url().max(2_000),
})
  .strict()
  .superRefine(requireItemsOrLegacyList);

export type GptPlanCreateInput = z.infer<typeof gptPlanCreateInputSchema>;

const listMarker = /^\s*(?:[-*•▪◦]|\d{1,3}[.)])\s*/u;
const budgetLine = /(?:총\s*)?예산|(?:총\s*)?금액\s*목표|\d[\d,\s]*\s*원\s*(?:이내|이하|정도|목표)/u;
const ruleLine = /예산\s*초과\s*시|대체\s*우선순위|우선순위\s*[:：]|제외\s*(?:→|->)|(?:품절|초과)\s*시\s*대체/u;
const headingLine = /^(?:오늘\s*(?:먹을|살)\s*)?(?:반찬거리|간식거리|먹거리|장보기|쇼핑\s*(?:목록|계획)|구매\s*목록|추천\s*목록)$/u;

const cleanEntry = (value: string) => value.replace(listMarker, "").replace(/\s+/gu, " ").trim();

const budgetFrom = (value: string) => {
  const match = value.match(/(\d[\d,\s]*)\s*원/u);
  if (!match) return null;
  const amount = Number(match[1].replace(/[,\s]/gu, ""));
  return Number.isSafeInteger(amount) && amount > 0 ? amount : null;
};

const nonProductReason = (value: string): "budget" | "rule" | "heading" | null => {
  if (ruleLine.test(value)) return "rule";
  if (budgetLine.test(value)) return "budget";
  if (headingLine.test(value)) return "heading";
  return null;
};

export type NormalizedGptPlanInput = {
  shoppingList: string;
  context: {
    goal: string | null;
    budgetWon: number | null;
    notes: string[];
  };
  ignoredEntries: string[];
  consentToStoreRaw: boolean;
};

/**
 * GPT Actions are model-generated input and must not be trusted as a clean
 * shopping list. Keep goals, budgets and fallback rules in plan context so
 * they never become Coupang search rows.
 */
export function normalizeGptPlanInput(input: GptPlanCreateInput): NormalizedGptPlanInput {
  const concreteEntries: string[] = [];
  const ignoredEntries: string[] = [];
  const notes = [...(input.context?.notes ?? [])];
  let goal = input.context?.goal ?? null;
  let budgetWon = input.context?.budgetWon ?? null;

  const consider = (entry: string, structured = false) => {
    const cleaned = cleanEntry(entry);
    if (!cleaned) return;
    const reason = nonProductReason(cleaned);
    if (!reason) {
      concreteEntries.push(cleaned);
      return;
    }
    ignoredEntries.push(cleaned);
    if (reason === "budget") budgetWon ??= budgetFrom(cleaned);
    if (reason === "heading") goal ??= cleaned;
    if (reason === "rule" && !structured && !notes.includes(cleaned)) notes.push(cleaned);
  };

  if (input.items?.length) {
    for (const item of input.items) {
      const productName = cleanEntry(item.productName);
      if (nonProductReason(productName)) {
        consider(productName, true);
        continue;
      }
      consider([productName, item.specification, item.quantity].filter(Boolean).join(" "), true);
    }
  } else {
    for (const line of input.shoppingList?.split(/\r?\n/u) ?? []) consider(line);
  }

  const uniqueEntries = [...new Map(concreteEntries.map((entry) => [entry.toLocaleLowerCase("ko-KR"), entry])).values()];
  z.array(z.string().min(1)).min(1).max(50).parse(uniqueEntries);

  return {
    shoppingList: uniqueEntries.join("\n"),
    context: {
      goal,
      budgetWon,
      notes: [...new Set(notes)].slice(0, 10),
    },
    ignoredEntries,
    consentToStoreRaw: input.consentToStoreRaw === true,
  };
}

const itemSchema = {
  type: "object",
  additionalProperties: false,
  required: ["productName"],
  properties: {
    productName: {
      type: "string",
      minLength: 1,
      maxLength: 200,
      description: "구매 가능한 구체적인 상품명만 입력합니다. 목표, 예산, 메뉴명, 목록 제목, 제외 규칙은 넣지 않습니다. 예: 두부, 콩나물, 애호박.",
    },
    specification: {
      type: "string",
      minLength: 1,
      maxLength: 200,
      description: "용량·크기·맛·형태 등 상품 규격입니다. 예: 300g, 대용량, 저자극.",
    },
    quantity: {
      type: "string",
      minLength: 1,
      maxLength: 100,
      description: "사용자가 구매할 수량 또는 묶음 구성입니다. 예: 1모, 1봉, 6구 1팩.",
    },
  },
} as const;

const contextSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    goal: { type: "string", maxLength: 300, description: "상품이 아닌 쇼핑 목적이나 상황입니다. 예: 오늘 먹을 반찬거리." },
    budgetWon: { type: "integer", minimum: 1, maximum: 100_000_000, description: "사용자가 제시한 총예산 목표(원)입니다. 상품 항목으로 만들지 않습니다." },
    notes: {
      type: "array",
      maxItems: 10,
      items: { type: "string", minLength: 1, maxLength: 300 },
      description: "제외 조건이나 대체 우선순위 같은 계획 메모입니다. 상품 항목으로 만들지 않습니다.",
    },
  },
} as const;

const planPayloadSchema = {
  type: "object",
  additionalProperties: false,
  required: ["items"],
  properties: {
    items: {
      type: "array",
      minItems: 1,
      maxItems: 50,
      items: itemSchema,
      description: "최종 추천하거나 사용자가 확정한 실제 구매 상품만 넣습니다. 제목, 예산, 식단 목표, 대체 규칙은 각각 context로 분리합니다.",
    },
    context: contextSchema,
    consentToStoreRaw: { type: "boolean", default: false, description: "입력 원문을 24시간 계획 링크에 보관해 다시 보여줄지 여부입니다. 기본값은 false입니다." },
  },
} as const;

const responseSchema = {
  type: "object",
  required: ["planUrl", "expiresAt", "plan"],
  properties: {
    planUrl: { type: "string", format: "uri" },
    expiresAt: { type: "integer" },
    plan: { type: "object", description: "딱담아가 정규화한 계획입니다." },
    ignoredEntries: {
      type: "array",
      items: { type: "string" },
      description: "상품 행으로 저장하지 않고 계획 문맥으로 분리한 입력입니다.",
    },
  },
} as const;

export const gptActionsOpenApi = (origin: string) => ({
  openapi: "3.1.0",
  info: {
    title: "딱담아 쇼핑 계획 API",
    version: "0.2.0-beta",
    description: "구체적인 구매 상품과 쇼핑 목적·예산·규칙을 분리해 딱담아의 단기 계획 링크로 이어주는 API입니다. 쿠팡 로그인, 결제, 주문, 자동 장바구니 기능은 제공하지 않습니다.",
  },
  servers: [{ url: origin }],
  paths: {
    "/api/gpt/plans": {
      post: {
        operationId: "createDdakdamaShoppingPlan",
        summary: "딱담아 쇼핑 계획 만들기",
        description: "Create a shared DdakDama plan after choosing concrete products. Put only purchasable products in items; put the purpose, total budget and fallback rules in context. Return planUrl as one Markdown link.",
        requestBody: { required: true, content: { "application/json": { schema: planPayloadSchema } } },
        responses: {
          "201": { description: "A short-lived DdakDama plan link", content: { "application/json": { schema: responseSchema } } },
          "400": { description: "No concrete shopping products or invalid input" },
          "429": { description: "Rate limited" },
        },
      },
    },
    "/api/gpt/plans/replace": {
      post: {
        operationId: "replaceDdakdamaShoppingPlan",
        summary: "수정한 쇼핑 목록으로 새 계획 만들기",
        description: "Use this when the user changes an existing DdakDama list. Send the latest complete concrete product list and keep purpose, budget and rules in context. The previous short-lived planUrl is required.",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                ...planPayloadSchema,
                required: ["planUrl", "items"],
                properties: {
                  planUrl: { type: "string", format: "uri" },
                  ...planPayloadSchema.properties,
                },
              },
            },
          },
        },
        responses: { "201": { description: "Replacement plan link", content: { "application/json": { schema: responseSchema } } }, "404": { description: "Expired or invalid plan link" } },
      },
    },
    "/api/gpt/plans/handoff": {
      post: {
        operationId: "getDdakdamaPlanLink",
        summary: "딱담아 계획 링크 확인",
        description: "Use this when the user asks to reopen a current DdakDama plan. It does not search Coupang or perform shopping actions.",
        requestBody: { required: true, content: { "application/json": { schema: { type: "object", additionalProperties: false, required: ["planUrl"], properties: { planUrl: { type: "string", format: "uri" } } } } } },
        responses: { "200": { description: "Still-valid plan link" }, "404": { description: "Expired or invalid plan link" } },
      },
    },
  },
});
