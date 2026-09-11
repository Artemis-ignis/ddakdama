import { createMcpHandler } from "agents/mcp";
import { z } from "zod";
import {
  cartExecutionItemStatuses,
  answerClarification,
  nextRequiredClarification,
  type Clarification,
  cartPlanSchema,
  createCartExecution,
  createCartPlan,
  finalizePlanStatus,
  cartPurchaseQuantityFor,
  productCandidateSchema,
  type CartPlan,
} from "@ddakdama/core";
import {
  createMcpServer,
  type McpStore,
} from "../../server/src/mcp.js";
import {
  LEGACY_WIDGET_URIS,
  WIDGET_URI,
  appIconDataUrl,
  widgetHtml,
} from "../.generated/widget.js";
import {
  configured as partnersConfigured,
  createDeepLinks,
  normalizeDeepLinkPayload,
  normalizeSearchPayload,
  searchProducts,
  type PartnersConfig,
} from "./partners.js";
import { secureShard, ttl } from "./helpers.js";
import {
  gptActionsOpenApi,
  gptPlanCreateInputSchema,
  gptPlanReplaceInputSchema,
  normalizeGptPlanInput,
} from "./gpt-actions.js";
import {
  privacyPage,
  supportPage,
  termsPage,
} from "./site.js";
import {
  DdakDamaState,
  normalizePairingCode,
  shardFromDeviceId,
  shardFromOpaqueToken,
} from "./state.js";

export { DdakDamaState } from "./state.js";

export interface Env {
  DDAKDAMA_STATE: DurableObjectNamespace<DdakDamaState>;
  ASSETS: Fetcher;
  PAIRING_TTL_SECONDS?: string;
  DEVICE_TOKEN_TTL_SECONDS?: string;
  CONNECTION_GRANT_TTL_SECONDS?: string;
  HANDOFF_TTL_SECONDS?: string;
  COUPANG_PARTNERS_ACCESS_KEY?: string;
  COUPANG_PARTNERS_SECRET_KEY?: string;
  COUPANG_PARTNERS_SUB_ID?: string;
  ALLOWED_EXTENSION_IDS?: string;
  SUPPORT_ADMIN_TOKEN?: string;
  SUPPORT_TICKET_TTL_SECONDS?: string;
  AFFILIATE_API_ENABLED?: string;
  MOBILE_CART_RUNNER_ENABLED?: string;
  REAL_COUPANG_AUTOMATION_ENABLED?: string;
  FIXTURE_CATALOG_ENABLED?: string;
  DDAKDAMA_APP_LINK_BASE?: string;
  DDAKDAMA_PLAN_LINK_BASE?: string;
  GPT_PLAN_GRANT_TTL_SECONDS?: string;
  GEMINI_API_KEY?: string;
  GEMINI_MODEL?: string;
  PLAN_TTL_SECONDS?: string;
}

const jsonHeaders = {
  "cache-control": "no-store",
  "content-type": "application/json; charset=utf-8",
  "x-content-type-options": "nosniff",
  "referrer-policy": "no-referrer",
} as const;

const stateForShard = (env: Env, shard: string) =>
  env.DDAKDAMA_STATE.get(env.DDAKDAMA_STATE.idFromName(`shard-${shard}`));

const pairingRateState = (env: Env) => stateForShard(env, "pairing-rate");

const clientKey = (request: Request) =>
  request.headers.get("cf-connecting-ip") ??
  request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
  "unknown";

const allowedOrigin = (request: Request, env: Env) => {
  const origin = request.headers.get("origin") ?? "";
  const match = origin.match(/^chrome-extension:\/\/([a-p]{32})$/);
  if (match) {
    const configuredIds = (env.ALLOWED_EXTENSION_IDS ?? "")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean);
    return configuredIds.length === 0 || configuredIds.includes(match[1])
      ? origin
      : "null";
  }
  return /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)
    ? origin
    : "null";
};

const corsHeaders = (request: Request, env: Env) => ({
  "access-control-allow-origin": allowedOrigin(request, env),
  "access-control-allow-methods": "GET,POST,PATCH,DELETE,OPTIONS",
  "access-control-allow-headers": "authorization,content-type",
  "access-control-max-age": "600",
  vary: "Origin",
});

const responseJson = (
  request: Request,
  env: Env,
  data: unknown,
  status = 200,
) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { ...jsonHeaders, ...corsHeaders(request, env) },
  });

const readJson = async (request: Request) => {
  const text = await request.text();
  if (new TextEncoder().encode(text).byteLength > 65_536) {
    throw new Error("BODY_TOO_LARGE");
  }
  return JSON.parse(text || "{}");
};

const bearer = (request: Request) =>
  (request.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");

const stateFromOpaque = (env: Env, value: string) => {
  const shard = shardFromOpaqueToken(value);
  return shard ? stateForShard(env, shard) : null;
};

const stateFromDevice = (env: Env, value: string) => {
  const shard = shardFromDeviceId(value);
  return shard ? stateForShard(env, shard) : null;
};

const redactPlanRawText = (plan: CartPlan): CartPlan => cartPlanSchema.parse({
  ...plan,
  items: plan.items.map((item) => ({
    ...item,
    request: { ...item.request, rawText: "입력 원문은 저장하지 않음" },
  })),
});

const createStore = (env: Env): McpStore => {
  // The MCP tool needs both the public plan id and a widget-only capability.
  // It calls this helper twice while constructing one result; evict after the
  // second read so a later user invocation always receives a fresh plan.
  const persistedPlanCache = new Map<string, { planId: string; accessToken: string; reads: number }>();
  return {
  async createPersistedPlan(shoppingList) {
    const cached = persistedPlanCache.get(shoppingList);
    if (cached) {
      cached.reads += 1;
      if (cached.reads >= 2) persistedPlanCache.delete(shoppingList);
      return cached;
    }
    const created = await planState(env).createPlan(redactPlanRawText(createCartPlan(shoppingList)));
    const persisted = { planId: created.plan.id, accessToken: created.accessToken, reads: 1 };
    persistedPlanCache.set(shoppingList, persisted);
    return persisted;
  },
  async validatePlanCapability(planId, accessToken) {
    const plan = await planState(env).readPlan(planId, accessToken);
    return plan ? { version: plan.version } : null;
  },
  async createMobilePlanLink(planId, accessToken) {
    const plan = await planState(env).readPlan(planId, accessToken);
    if (!plan) return null;
    const claim = await planState(env).issuePlanClaimToken(plan.id, ttl(env.HANDOFF_TTL_SECONDS, 900));
    if (!claim) return null;
    const appBase = (env.DDAKDAMA_PLAN_LINK_BASE ?? "ddakdama://plan").replace(/\/$/, "");
    return {
      appLink: `${appBase}/${plan.id}?claim=${encodeURIComponent(claim.claimToken)}`,
      expiresAt: claim.expiresAt,
    };
  },
  async completePairing(code, pairingClientKey = "unknown", pairingNonce) {
    const normalized = normalizePairingCode(code);
    if (!normalized) return null;
    if (!(await pairingRateState(env).allowPairingAttempt(pairingClientKey, 30))) {
      return null;
    }
    return stateForShard(env, normalized[0]).completePairing(
      normalized,
      pairingClientKey,
      ttl(env.CONNECTION_GRANT_TTL_SECONDS, 2_592_000),
      pairingNonce,
    );
  },
  async authenticateGrant(grant) {
    const state = stateFromOpaque(env, grant);
    return state ? state.authenticateGrant(grant) : null;
  },
  async createHandoff(deviceId, payload, idempotencyKey) {
    const state = stateFromDevice(env, deviceId);
    if (!state) throw new Error("INVALID_DEVICE_ID");
    return state.createHandoff(
      deviceId,
      payload,
      idempotencyKey,
      ttl(env.HANDOFF_TTL_SECONDS, 900),
    );
  },
  async handoffStatus(deviceId, id) {
    const state = stateFromDevice(env, deviceId);
    return state ? state.handoffStatus(deviceId, id) : null;
  },
  async revokeConnectionGrant(grant) {
    const state = stateFromOpaque(env, grant);
    return state ? state.revokeByToken("grant", grant) : false;
  },
  };
};

const partnersConfig = (env: Env): PartnersConfig => ({
  accessKey: (env.COUPANG_PARTNERS_ACCESS_KEY ?? "").trim(),
  secretKey: (env.COUPANG_PARTNERS_SECRET_KEY ?? "").trim(),
  subId: (env.COUPANG_PARTNERS_SUB_ID ?? "ddakdama-extension")
    .replace(/[^a-zA-Z0-9_-]/g, "-")
    .slice(0, 64),
});

const searchInput = z.object({
  keyword: z.string().trim().min(1).max(200),
  limit: z.number().int().min(1).max(20).default(10),
});

const deepLinkInput = z.object({
  urls: z
    .array(
      z.string().url().refine((value) => {
        const host = new URL(value).hostname;
        return host === "coupang.com" || host.endsWith(".coupang.com");
      }),
    )
    .min(1)
    .max(20),
  });

const planCreateInput = z.object({
  shoppingList: z.string().trim().min(1).max(20_000),
  consentToStoreRaw: z.boolean().default(false),
});
const gptPlanLinkInput = z.object({ planUrl: z.string().url().max(2_000) });
const planUpdateInput = z.object({
  expectedVersion: z.number().int().positive(),
  selectedCandidateIds: z.record(z.string(), z.string().max(200)).optional(),
  quantityUpdates: z.record(z.string(), z.number().int().positive().max(10_000)).optional(),
});
const executionCreateInput = z.object({
  planId: z.uuid(),
  planVersion: z.number().int().positive(),
  allowCanonicalFallback: z.boolean().default(false),
  userApproved: z.boolean().default(false),
  preflightToken: z.string().min(32).max(128),
  executionMode: z.enum(["BATCH_CART_ADD"]).default("BATCH_CART_ADD"),
});
const executionClaimInput = z.object({ claimToken: z.string().min(32).max(128) });
const planClaimInput = z.object({ claimToken: z.string().min(32).max(128) });
const executionItemUpdateInput = z.object({
  status: z.enum(cartExecutionItemStatuses),
  message: z.string().trim().max(500).nullable().default(null),
});
const aiShoppingInput = z.object({ instruction: z.string().trim().min(1).max(2_000), currentList: z.string().trim().max(20_000).optional() });
const anonymousEventInput = z.object({
  name: z.enum(["PAGE_VIEW", "LIST_CREATED", "CLARIFICATION_SHOWN", "CLARIFICATION_ANSWERED", "CANDIDATE_SELECTED", "QUANTITY_CHANGED", "LINK_OPENED", "ASSISTANT_USED"]),
  sessionId: z.string().regex(/^[A-Za-z0-9_-]{16,80}$/),
  planId: z.uuid().optional(),
  properties: z.record(z.string(), z.union([z.string().max(120), z.number().finite(), z.boolean()])).default({}),
});
const clarificationInput = z.object({
  itemId: z.string().min(1).max(100),
  optionId: z.string().min(1).max(80).optional(),
  answerText: z.string().trim().max(300).optional(),
});

const planState = (env: Env) => stateForShard(env, "plans");
// Keep the public beta in the safe, non-affiliate mode until Coupang confirms
// the API/data-use path in writing.  A key alone must never activate it.
const validAffiliateFeature = (env: Env) => env.AFFILIATE_API_ENABLED === "true";
const fixtureCatalogEnabled = (env: Env) => env.FIXTURE_CATALOG_ENABLED === "true";

const aiClarification = async (env: Env, clarification: Clarification, rawText: string): Promise<Clarification> => {
  const key = env.GEMINI_API_KEY?.trim();
  if (!key) return clarification;
  const model = (env.GEMINI_MODEL ?? "gemini-3.5-flash").replace(/[^a-zA-Z0-9._-]/g, "");
  const prompt = [
    "Korean shopping clarification assistant.",
    "Return JSON only: {question:string, options:[{id:string,label:string}], allowFreeText:boolean}.",
    "Ask at most one short question needed to turn the shopping item into a searchable product.",
    "Never mention price, seller, stock, shipping, payment, or facts not present in the input.",
    `Shopping item: ${rawText}`,
    `Fallback question: ${clarification.question}`,
  ].join("\n");
  try {
    const upstream = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-goog-api-key": key },
      body: JSON.stringify({ contents: [{ role: "user", parts: [{ text: prompt }] }], generationConfig: { temperature: 0.1, maxOutputTokens: 256 } }),
    });
    if (!upstream.ok) return clarification;
    const payload = await upstream.json() as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
    const raw = payload.candidates?.[0]?.content?.parts?.map((part) => part.text ?? "").join("").trim();
    if (!raw) return clarification;
    const parsed = JSON.parse(raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/u, "")) as { question?: string; options?: Array<{ id?: string; label?: string }>; allowFreeText?: boolean };
    const options = (parsed.options ?? [])
      .filter((item) => typeof item.id === "string" && typeof item.label === "string")
      .slice(0, 5)
      .map((item) => ({ id: item.id!.slice(0, 80), label: item.label!.slice(0, 120) }));
    if (!parsed.question || options.length === 0) return clarification;
    return { ...clarification, question: parsed.question.slice(0, 500), options, allowFreeText: parsed.allowFreeText !== false, source: "AI" };
  } catch {
    return clarification;
  }
};

const enrichClarifications = async (env: Env, items: CartPlan["items"]) => Promise.all(items.map(async (item) => (
  item.clarification?.status === "REQUIRED"
    ? { ...item, clarification: await aiClarification(env, item.clarification, item.request.normalizedText) }
    : item
)));

const publicPlanUrl = (origin: string, planId: string, planGrant: string) => {
  const link = new URL(origin);
  link.pathname = "/";
  link.searchParams.set("plan", planId);
  link.searchParams.set("grant", planGrant);
  return link.toString();
};

const gptPlanCredentials = (planUrl: string, requestUrl: URL) => {
  const link = new URL(planUrl);
  if (link.origin !== requestUrl.origin || !["/", "/app", "/app/"].includes(link.pathname)) {
    return null;
  }
  const planId = link.searchParams.get("plan") ?? "";
  const grant = link.searchParams.get("grant") ?? "";
  return z.uuid().safeParse(planId).success && /^[A-Za-z0-9_-]{32,128}$/.test(grant)
    ? { planId, grant }
    : null;
};

const gptPlanResponse = (
  origin: string,
  created: { plan: CartPlan; planGrant: string; expiresAt: number },
  ignoredEntries: string[] = [],
) => ({
  plan: created.plan,
  expiresAt: created.expiresAt,
  planUrl: publicPlanUrl(origin, created.plan.id, created.planGrant),
  message: "딱담아 웹에서 목록을 계속 확인하고 수정할 수 있습니다.",
  ignoredEntries,
});

const fixtureCandidateFor = (item: { id: string; request: { productName: string; requestedPhysicalUnits: number } }, index: number) =>
  productCandidateSchema.parse({
    id: `fixture-${item.id}`,
    productId: String(9_000_000 + index),
    vendorItemId: `fixture-vendor-${index}`,
    itemId: null,
    title: `${item.request.productName} (fixture)`,
    currentPrice: 1_000 + index * 100,
    unitsPerPackage: item.request.requestedPhysicalUnits,
    imageUrl: null,
    seller: "DdakDama fixture",
    fulfillmentType: "ROCKET",
    deliveryPromise: "fixture delivery",
    shippingFee: 0,
    freeShippingThreshold: null,
    deliveryCertainty: "CONFIRMED",
    stockStatus: "IN_STOCK",
    requiredOption: false,
    source: "FIXTURE",
    canonicalUrl: `https://www.coupang.com/vp/products/${9_000_000 + index}?vendorItemId=fixture-${index}`,
    partnersSearchUrl: null,
    affiliateUrl: null,
    affiliateVerified: false,
    affiliateResolvedAt: null,
    affiliateSubId: null,
  });
const toPlanCandidate = (value: Record<string, unknown>) => productCandidateSchema.safeParse({
  id: value.id,
  productId: value.productId,
  vendorItemId: value.vendorItemId ?? null,
  itemId: value.itemId ?? null,
  title: value.title,
  currentPrice: value.currentPrice ?? null,
  unitsPerPackage: value.unitsPerPackage ?? 1,
  imageUrl: typeof value.imageUrl === "string" && /^https:\/\//i.test(value.imageUrl) ? value.imageUrl : null,
  seller: null,
  fulfillmentType: value.rocketDelivery ? "ROCKET" : "UNKNOWN",
  deliveryPromise: null,
  shippingFee: null,
  freeShippingThreshold: null,
  deliveryCertainty: "UNKNOWN",
  stockStatus: "UNKNOWN",
  requiredOption: false,
  source: value.source ?? "PARTNERS",
  canonicalUrl: value.canonicalUrl ?? value.productUrl,
  partnersSearchUrl: value.partnersSearchUrl ?? null,
  affiliateUrl: value.affiliateUrl ?? null,
  affiliateVerified: value.affiliateVerified ?? false,
  affiliateResolvedAt: value.affiliateResolvedAt ?? null,
  affiliateSubId: value.affiliateSubId ?? null,
});

const supportInput = z.object({
  email: z.string().trim().email().max(320),
  subject: z.string().trim().min(2).max(120),
  message: z.string().trim().min(10).max(4_000),
  website: z.string().max(200).optional().default(""),
});

const readSupportInput = async (request: Request) => {
  const contentType = request.headers.get("content-type") ?? "";
  if (contentType.includes("application/x-www-form-urlencoded")) {
    const text = await request.text();
    if (new TextEncoder().encode(text).byteLength > 16_384) {
      throw new Error("BODY_TOO_LARGE");
    }
    return supportInput.parse(Object.fromEntries(new URLSearchParams(text)));
  }
  return supportInput.parse(await readJson(request));
};

const constantTimeEqual = async (left: string, right: string) => {
  if (!left || !right) return false;
  const encoder = new TextEncoder();
  const [leftHash, rightHash] = await Promise.all([
    crypto.subtle.digest("SHA-256", encoder.encode(left)),
    crypto.subtle.digest("SHA-256", encoder.encode(right)),
  ]);
  const leftBytes = new Uint8Array(leftHash);
  const rightBytes = new Uint8Array(rightHash);
  let difference = 0;
  for (let index = 0; index < leftBytes.length; index += 1) {
    difference |= leftBytes[index] ^ rightBytes[index];
  }
  return difference === 0;
};

const supportAdminAuthorized = (request: Request, env: Env) =>
  constantTimeEqual(bearer(request), (env.SUPPORT_ADMIN_TOKEN ?? "").trim());

async function handleApi(request: Request, env: Env, url: URL) {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders(request, env) });
  }

  if (request.method === "POST" && url.pathname === "/api/events") {
    if (!(await stateForShard(env, "event-rate").allowAnonymousEvent(clientKey(request)))) {
      return responseJson(request, env, { error: "rate_limited" }, 429);
    }
    const input = anonymousEventInput.parse(await readJson(request));
    await planState(env).recordAnonymousEvent(input, ttl(env.PLAN_TTL_SECONDS, 86_400));
    return responseJson(request, env, { ok: true }, 202);
  }

  if (request.method === "POST" && url.pathname === "/api/pairing/start") {
    await readJson(request);
    if (!(await pairingRateState(env).allowPairingStart(clientKey(request), 10))) {
      return responseJson(request, env, { error: "rate_limited" }, 429);
    }
    const shard = secureShard();
    const state = stateForShard(env, shard);
    const pairing = await state.startPairing(
      shard,
      ttl(env.PAIRING_TTL_SECONDS, 600),
      ttl(env.DEVICE_TOKEN_TTL_SECONDS, 2_592_000),
    );
    return responseJson(request, env, pairing, 201);
  }

  if (request.method === "GET" && url.pathname === "/api/pairing/status") {
    const token = bearer(request);
    const state = stateFromOpaque(env, token);
    const deviceId = state ? await state.authenticateDevice(token) : null;
    if (!state || !deviceId) {
      return responseJson(request, env, { error: "unauthorized" }, 401);
    }
    return responseJson(request, env, await state.pairingStatus(deviceId));
  }

  if (request.method === "POST" && url.pathname === "/api/support") {
    const origin = request.headers.get("origin");
    if (origin && origin !== url.origin) {
      return responseJson(request, env, { error: "forbidden_origin" }, 403);
    }
    const input = await readSupportInput(request);
    const isForm = (request.headers.get("content-type") ?? "").includes(
      "application/x-www-form-urlencoded",
    );
    if (input.website) {
      return isForm
        ? Response.redirect(`${url.origin}/support?submitted=1`, 303)
        : responseJson(request, env, { ok: true }, 201);
    }
    const rateState = stateForShard(env, "support-rate");
    if (!(await rateState.allowSupportSubmission(clientKey(request), 5))) {
      return isForm
        ? Response.redirect(`${url.origin}/support?error=rate`, 303)
        : responseJson(request, env, { error: "rate_limited" }, 429);
    }
    const ticket = await stateForShard(env, "support-inbox").createSupportTicket(
      {
        email: input.email,
        subject: input.subject,
        message: input.message,
      },
      ttl(env.SUPPORT_TICKET_TTL_SECONDS, 2_592_000),
    );
    return isForm
      ? Response.redirect(
          `${url.origin}/support?submitted=1&ticket=${encodeURIComponent(ticket.id)}`,
          303,
        )
      : responseJson(request, env, { ok: true, ticketId: ticket.id }, 201);
  }

  if (request.method === "GET" && url.pathname === "/api/support/tickets") {
    if (!(await supportAdminAuthorized(request, env))) {
      return responseJson(request, env, { error: "unauthorized" }, 401);
    }
    const limit = Math.min(Math.max(Number(url.searchParams.get("limit")) || 50, 1), 100);
    return responseJson(request, env, {
      tickets: await stateForShard(env, "support-inbox").listSupportTickets(limit),
    });
  }

  const resolveTicket = url.pathname.match(
    /^\/api\/support\/tickets\/([A-Z0-9-]+)\/resolve$/,
  );
  if (request.method === "POST" && resolveTicket) {
    if (!(await supportAdminAuthorized(request, env))) {
      return responseJson(request, env, { error: "unauthorized" }, 401);
    }
    const ticket = await stateForShard(env, "support-inbox").resolveSupportTicket(
      resolveTicket[1],
    );
    return responseJson(
      request,
      env,
      ticket ? { ok: true, ticket } : { error: "not_found" },
      ticket ? 200 : 404,
    );
  }

  if (request.method === "GET" && url.pathname === "/api/handoffs/latest") {
    const token = bearer(request);
    const state = stateFromOpaque(env, token);
    const deviceId = state ? await state.authenticateDevice(token) : null;
    if (!state || !deviceId) {
      return responseJson(request, env, { error: "unauthorized" }, 401);
    }
    return responseJson(request, env, {
      handoff: await state.latestHandoff(deviceId),
    });
  }

  const ack = url.pathname.match(/^\/api\/handoffs\/([^/]+)\/ack$/);
  if (request.method === "POST" && ack) {
    const token = bearer(request);
    const state = stateFromOpaque(env, token);
    const deviceId = state ? await state.authenticateDevice(token) : null;
    if (!state || !deviceId) {
      return responseJson(request, env, { error: "unauthorized" }, 401);
    }
    const acknowledged = await state.ackHandoff(deviceId, ack[1]);
    return responseJson(
      request,
      env,
      { ok: acknowledged },
      acknowledged ? 200 : 404,
    );
  }

  if (request.method === "POST" && url.pathname === "/api/device/revoke") {
    const token = bearer(request);
    const state = stateFromOpaque(env, token);
    const deviceId = state ? await state.authenticateDevice(token) : null;
    if (!state || !deviceId) {
      return responseJson(request, env, { error: "unauthorized" }, 401);
    }
    return responseJson(request, env, {
      ok: await state.revokeByToken("token", token),
    });
  }

  if (request.method === "POST" && url.pathname === "/api/mobile/installations/register") {
    await readJson(request);
    if (!(await pairingRateState(env).allowPairingStart(clientKey(request), 10))) {
      return responseJson(request, env, { error: "rate_limited" }, 429);
    }
    const shard = secureShard();
    const installation = await stateForShard(env, shard).startPairing(
      shard,
      ttl(env.PAIRING_TTL_SECONDS, 600),
      ttl(env.DEVICE_TOKEN_TTL_SECONDS, 2_592_000),
    );
    // Mobile installations do not need the legacy six-digit ChatGPT pairing code.
    return responseJson(request, env, {
      installationId: installation.deviceId,
      deviceToken: installation.deviceToken,
      expiresAt: installation.expiresAt,
    }, 201);
  }

  if (request.method === "POST" && url.pathname === "/api/ai/shopping-list") {
    const input = aiShoppingInput.parse(await readJson(request));
    if (!(await pairingRateState(env).allowPairingStart(clientKey(request), 10))) return responseJson(request, env, { error: "rate_limited" }, 429);
    const key = env.GEMINI_API_KEY?.trim();
    if (!key) return responseJson(request, env, { available: false, provider: "gemini", error: "AI_PROVIDER_UNAVAILABLE", message: "AI 도움은 아직 설정되지 않았습니다. 목록을 직접 입력해 주세요." }, 503);
    const model = (env.GEMINI_MODEL ?? "gemini-3.5-flash").replace(/[^a-zA-Z0-9._-]/g, "");
    const prompt = `Korean shopping-list assistant. Return only concrete purchasable Korean shopping-list lines, one item per line. Never claim price, stock, shipping, seller, coupon, or Coupang facts. This is a draft for user review. Request: ${input.instruction}${input.currentList ? `\nCurrent list:\n${input.currentList}` : ""}`;
    const upstream = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, { method: "POST", headers: { "content-type": "application/json", "x-goog-api-key": key }, body: JSON.stringify({ contents: [{ role: "user", parts: [{ text: prompt }] }], generationConfig: { temperature: 0.2, maxOutputTokens: 512 } }) });
    if (!upstream.ok) return responseJson(request, env, { available: false, provider: "gemini", error: "AI_PROVIDER_FAILED" }, 502);
    const payload = await upstream.json() as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
    const draft = payload.candidates?.[0]?.content?.parts?.map((part) => part.text ?? "").join("").trim();
    if (!draft) return responseJson(request, env, { available: false, provider: "gemini", error: "AI_EMPTY_RESPONSE" }, 502);
    return responseJson(request, env, { available: true, provider: "gemini", suggestedShoppingList: draft, requiresUserReview: true });
  }

  if (request.method === "POST" && url.pathname === "/api/gpt/plans") {
    if (!(await planState(env).allowGptPlan(clientKey(request)))) {
      return responseJson(request, env, { error: "rate_limited" }, 429);
    }
    const input = gptPlanCreateInputSchema.parse(await readJson(request));
    const normalized = normalizeGptPlanInput(input);
    const plan = createCartPlan(normalized.shoppingList, undefined, undefined, normalized.context);
    const created = await planState(env).createGptPlan(
      normalized.consentToStoreRaw ? plan : redactPlanRawText(plan),
      ttl(env.GPT_PLAN_GRANT_TTL_SECONDS, 900),
      ttl(env.PLAN_TTL_SECONDS, 86_400),
    );
    return responseJson(request, env, gptPlanResponse(url.origin, created, normalized.ignoredEntries), 201);
  }

  if (request.method === "POST" && url.pathname === "/api/gpt/plans/replace") {
    const input = gptPlanReplaceInputSchema.parse(await readJson(request));
    const credentials = gptPlanCredentials(input.planUrl, url);
    if (!credentials || !(await planState(env).readPlan(credentials.planId, credentials.grant))) {
      return responseJson(request, env, { error: "plan_link_expired" }, 404);
    }
    if (!(await planState(env).allowGptPlan(clientKey(request)))) {
      return responseJson(request, env, { error: "rate_limited" }, 429);
    }
    const normalized = normalizeGptPlanInput(input);
    const plan = createCartPlan(normalized.shoppingList, undefined, undefined, normalized.context);
    const created = await planState(env).createGptPlan(
      normalized.consentToStoreRaw ? plan : redactPlanRawText(plan),
      ttl(env.GPT_PLAN_GRANT_TTL_SECONDS, 900),
      ttl(env.PLAN_TTL_SECONDS, 86_400),
    );
    return responseJson(request, env, gptPlanResponse(url.origin, created, normalized.ignoredEntries), 201);
  }

  if (request.method === "POST" && url.pathname === "/api/gpt/plans/handoff") {
    const input = gptPlanLinkInput.parse(await readJson(request));
    const credentials = gptPlanCredentials(input.planUrl, url);
    if (!credentials || !(await planState(env).readPlan(credentials.planId, credentials.grant))) {
      return responseJson(request, env, { error: "plan_link_expired" }, 404);
    }
    return responseJson(request, env, {
      planUrl: publicPlanUrl(url.origin, credentials.planId, credentials.grant),
      message: "딱담아 웹에서 현재 계획을 계속 확인할 수 있습니다.",
    });
  }

  if (request.method === "POST" && url.pathname === "/api/plans") {
    const input = planCreateInput.parse(await readJson(request));
    const draft = createCartPlan(input.shoppingList);
    const plan = input.consentToStoreRaw ? draft : redactPlanRawText(draft);
    const created = await planState(env).createPlan(plan, ttl(env.PLAN_TTL_SECONDS, 86_400));
    return responseJson(request, env, created, 201);
  }

  const planMatch = url.pathname.match(/^\/api\/plans\/([0-9a-f-]{36})$/i);
  if (planMatch && request.method === "GET") {
    const plan = await planState(env).readPlan(planMatch[1], bearer(request));
    return responseJson(request, env, plan ? { plan } : { error: "not_found" }, plan ? 200 : 404);
  }

  if (planMatch && request.method === "PATCH") {
    const input = planUpdateInput.parse(await readJson(request));
    const current = await planState(env).readPlan(planMatch[1], bearer(request));
    if (!current) return responseJson(request, env, { error: "not_found" }, 404);
    if (current.version !== input.expectedVersion) return responseJson(request, env, { error: "version_conflict", plan: current }, 409);
    const items = current.items.map((item) => {
      const selectedCandidateId = input.selectedCandidateIds?.[item.id] ?? item.selectedCandidateId;
      const requestedPhysicalUnits = input.quantityUpdates?.[item.id];
      return selectedCandidateId && !item.candidates.some((candidate) => candidate.id === selectedCandidateId)
        ? item
        : {
          ...item,
          selectedCandidateId,
          request: requestedPhysicalUnits
            ? { ...item.request, requestedPhysicalUnits, requestedPurchaseUnits: requestedPhysicalUnits }
            : item.request,
        };
    });
    const next = cartPlanSchema.parse({
      ...current,
      version: current.version + 1,
      updatedAt: Date.now(),
      items,
      status: finalizePlanStatus({ ...current, items }),
    });
    const updated = await planState(env).updatePlan(current.id, bearer(request), input.expectedVersion, next);
    return responseJson(request, env, updated.kind === "updated" ? { plan: updated.plan } : { error: updated.kind, ...(updated.kind === "conflict" ? { plan: updated.plan } : {}) }, updated.kind === "updated" ? 200 : updated.kind === "conflict" ? 409 : 404);
  }

  const clarifyPlan = url.pathname.match(/^\/api\/plans\/([0-9a-f-]{36})\/clarify$/i);
  if (clarifyPlan && request.method === "POST") {
    const input = clarificationInput.parse(await readJson(request));
    const current = await planState(env).readPlan(clarifyPlan[1], bearer(request));
    if (!current) return responseJson(request, env, { error: "not_found" }, 404);
    const item = current.items.find((candidate) => candidate.id === input.itemId);
    if (!item?.clarification || item.clarification.status !== "REQUIRED") {
      return responseJson(request, env, { error: "clarification_not_required", plan: current }, 409);
    }
    const selectedOption = input.optionId ? item.clarification.options.find((option) => option.id === input.optionId) : null;
    const answer = selectedOption?.label ?? input.answerText ?? "";
    if (!answer.trim()) return responseJson(request, env, { error: "clarification_answer_required", plan: current }, 400);
    const resolved = answerClarification(item.request, item.clarification, answer, item.clarification.source);
    const items = current.items.map((candidate) => candidate.id === item.id
      ? { ...candidate, request: resolved.request, clarification: resolved.clarification, candidates: [], selectedCandidateId: null }
      : candidate);
    const next = cartPlanSchema.parse({ ...current, version: current.version + 1, updatedAt: Date.now(), status: "DRAFT", items });
    const updated = await planState(env).updatePlan(current.id, bearer(request), current.version, next);
    return responseJson(request, env, updated.kind === "updated"
      ? { plan: updated.plan, nextClarification: nextRequiredClarification(updated.plan.items) }
      : { error: updated.kind }, updated.kind === "updated" ? 200 : updated.kind === "conflict" ? 409 : 404);
  }

  const planClaimLink = url.pathname.match(/^\/api\/plans\/([0-9a-f-]{36})\/claim-link$/i);
  if (planClaimLink && request.method === "POST") {
    const plan = await planState(env).readPlan(planClaimLink[1], bearer(request));
    if (!plan) return responseJson(request, env, { error: "not_found" }, 404);
    const claim = await planState(env).issuePlanClaimToken(plan.id, ttl(env.HANDOFF_TTL_SECONDS, 900));
    if (!claim) return responseJson(request, env, { error: "claim_unavailable" }, 409);
    const appBase = (env.DDAKDAMA_PLAN_LINK_BASE ?? "ddakdama://plan").replace(/\/$/, "");
    return responseJson(request, env, {
      planId: plan.id,
      expiresAt: claim.expiresAt,
      appLink: `${appBase}/${plan.id}?claim=${encodeURIComponent(claim.claimToken)}`,
    });
  }

  const planClaim = url.pathname.match(/^\/api\/plans\/([0-9a-f-]{36})\/claim$/i);
  if (planClaim && request.method === "POST") {
    const token = bearer(request); const state = stateFromOpaque(env, token); const deviceId = state ? await state.authenticateDevice(token) : null;
    if (!deviceId) return responseJson(request, env, { error: "unauthorized" }, 401);
    const claimed = await planState(env).claimPlan(planClaim[1], planClaimInput.parse(await readJson(request)).claimToken, deviceId);
    return responseJson(request, env, claimed ? { plan: claimed.plan, accessToken: claimed.accessToken } : { error: "invalid_or_expired_claim" }, claimed ? 200 : 404);
  }

  const resolvePlan = url.pathname.match(/^\/api\/plans\/([0-9a-f-]{36})\/resolve$/i);
  if (resolvePlan && request.method === "POST") {
    const current = await planState(env).readPlan(resolvePlan[1], bearer(request));
    if (!current) return responseJson(request, env, { error: "not_found" }, 404);
    const enrichedItems = await enrichClarifications(env, current.items);
    const clarificationRequired = enrichedItems.some((item) => item.clarification?.status === "REQUIRED");
    const config = partnersConfig(env);
    if (fixtureCatalogEnabled(env) && (!validAffiliateFeature(env) || !partnersConfigured(config))) {
      const items = enrichedItems.map((item, index) => item.clarification?.status === "REQUIRED"
        ? { ...item, candidates: [], selectedCandidateId: null }
        : item.candidates.length > 0
          ? item
          : { ...item, candidates: [fixtureCandidateFor(item, index)], selectedCandidateId: null });
      const next = cartPlanSchema.parse({
        ...current,
        version: current.version + 1,
        updatedAt: Date.now(),
        status: clarificationRequired ? "DRAFT" : "REVIEW_REQUIRED",
        items,
      });
      const updated = await planState(env).updatePlan(current.id, bearer(request), current.version, next);
      return responseJson(
        request,
        env,
        updated.kind === "updated"
          ? {
              plan: updated.plan,
              fixture: true,
              affiliateAvailable: false,
              ...(clarificationRequired ? { clarificationRequired: true, nextClarification: nextRequiredClarification(updated.plan.items) } : {}),
            }
          : { error: updated.kind },
        updated.kind === "updated" ? 200 : 409,
      );
    }
    if (!validAffiliateFeature(env) || !partnersConfigured(config)) {
      // Product discovery is still useful before a Partners key is issued.
      // Keep the editable plan alive and make the client use an explicitly
      // non-affiliate Coupang search fallback instead of faking a deep link.
      const next = cartPlanSchema.parse({
        ...current,
        version: current.version + 1,
        updatedAt: Date.now(),
        status: clarificationRequired ? "DRAFT" : "REVIEW_REQUIRED",
        items: enrichedItems,
      });
      const updated = await planState(env).updatePlan(
        current.id,
        bearer(request),
        current.version,
        next,
      );
      return responseJson(
        request,
        env,
        updated.kind === "updated"
          ? {
              plan: updated.plan,
              fallback: "BROWSER_SEARCH",
              affiliateAvailable: false,
              ...(clarificationRequired ? { clarificationRequired: true, nextClarification: nextRequiredClarification(updated.plan.items) } : {}),
            }
          : { error: updated.kind },
        updated.kind === "updated" ? 200 : 409,
      );
    }
    const candidates = await Promise.all(enrichedItems.map(async (item) => {
      if (item.clarification?.status === "REQUIRED") return item.candidates;
      const raw = normalizeSearchPayload(await searchProducts(item.request.normalizedText, 3, config));
      return raw.map((value) => toPlanCandidate(value)).filter((value): value is { success: true; data: ReturnType<typeof productCandidateSchema.parse> } => value.success).map((value) => value.data);
    }));
    const items = enrichedItems.map((item, index) => ({ ...item, candidates: candidates[index] ?? [], selectedCandidateId: item.clarification?.status === "REQUIRED" ? null : item.selectedCandidateId }));
    const next = cartPlanSchema.parse({ ...current, version: current.version + 1, updatedAt: Date.now(), status: clarificationRequired ? "DRAFT" : "REVIEW_REQUIRED", items });
    const updated = await planState(env).updatePlan(current.id, bearer(request), current.version, next);
    return responseJson(request, env, updated.kind === "updated"
      ? { plan: updated.plan, ...(clarificationRequired ? { clarificationRequired: true, nextClarification: nextRequiredClarification(updated.plan.items) } : {}) }
      : { error: updated.kind }, updated.kind === "updated" ? 200 : 409);
  }

  const finalizeAffiliate = url.pathname.match(/^\/api\/plans\/([0-9a-f-]{36})\/finalize-affiliate-links$/i);
  if (finalizeAffiliate && request.method === "POST") {
    const current = await planState(env).readPlan(finalizeAffiliate[1], bearer(request));
    if (!current) return responseJson(request, env, { error: "not_found" }, 404);
    const selected = current.items.flatMap((item) => item.candidates.filter((candidate) => candidate.id === item.selectedCandidateId));
    if (!selected.length || selected.length !== current.items.length) return responseJson(request, env, { error: "selection_required", plan: current }, 409);
    const config = partnersConfig(env);
    if (!validAffiliateFeature(env) || !partnersConfigured(config)) {
      return responseJson(request, env, {
        plan: current,
        complete: false,
        fallback: "CANONICAL_URL",
        affiliateAvailable: false,
      });
    }
    const links = normalizeDeepLinkPayload(await createDeepLinks(selected.map((candidate) => candidate.canonicalUrl), config));
    const linkFor = new Map(links.map((link) => [link.originalUrl, link]));
    const items = current.items.map((item) => ({
      ...item,
      candidates: item.candidates.map((candidate) => {
        const link = linkFor.get(candidate.canonicalUrl);
        return link ? { ...candidate, affiliateUrl: link.landingUrl, affiliateVerified: link.affiliateVerified, affiliateResolvedAt: link.affiliateResolvedAt, affiliateSubId: config.subId } : candidate;
      }),
    }));
    const next = cartPlanSchema.parse({ ...current, version: current.version + 1, updatedAt: Date.now(), items, status: finalizePlanStatus({ ...current, items }) });
    const updated = await planState(env).updatePlan(current.id, bearer(request), current.version, next);
    return responseJson(request, env, updated.kind === "updated" ? { plan: updated.plan, complete: updated.plan.status === "READY" } : { error: updated.kind }, updated.kind === "updated" ? 200 : 409);
  }

  const preflight = url.pathname.match(/^\/api\/plans\/([0-9a-f-]{36})\/preflight$/i);
  if (preflight && request.method === "POST") {
    const plan = await planState(env).readPlan(preflight[1], bearer(request));
    if (!plan) return responseJson(request, env, { error: "not_found" }, 404);
    const items = plan.items.map((item) => {
      const candidate = item.candidates.find((value) => value.id === item.selectedCandidateId);
      const reasons: string[] = [];
      if (item.clarification?.status === "REQUIRED") reasons.push("clarification_required");
      if (!candidate) reasons.push("selection_required");
      else {
        if (candidate.currentPrice === null) reasons.push("price_unverified");
        if (candidate.requiredOption) reasons.push("option_required");
        if (candidate.stockStatus !== "IN_STOCK") reasons.push("stock_unverified");
      }
      return {
        itemId: item.id,
        status: reasons.length ? "BLOCKED" : "READY",
        reasons,
        cartPurchaseQuantity: candidate ? cartPurchaseQuantityFor(item, candidate) : null,
      };
    });
    const ok = items.every((item) => item.status === "READY");
    const issued = ok ? await planState(env).issuePlanPreflightToken(plan.id, plan.version, ttl(env.HANDOFF_TTL_SECONDS, 300)) : null;
    return responseJson(request, env, {
      planVersion: plan.version,
      ok,
      items,
      ...(issued ? { preflightToken: issued.preflightToken, expiresAt: issued.expiresAt } : {}),
    });
  }

  if (request.method === "POST" && url.pathname === "/api/executions") {
    const input = executionCreateInput.parse(await readJson(request));
    if (!input.userApproved) return responseJson(request, env, { error: "user_approval_required" }, 409);
    const plan = await planState(env).readPlan(input.planId, bearer(request));
    if (!plan) return responseJson(request, env, { error: "not_found" }, 404);
    if (plan.version !== input.planVersion) return responseJson(request, env, { error: "version_conflict", plan }, 409);
    const allSelected = plan.items.every((item) => item.candidates.some((candidate) => candidate.id === item.selectedCandidateId));
    if (!allSelected) return responseJson(request, env, { error: "selection_required", plan }, 409);
    const allAffiliatesReady = plan.items.every((item) => item.candidates.some((candidate) => candidate.id === item.selectedCandidateId && candidate.affiliateVerified));
    if (!allAffiliatesReady && !input.allowCanonicalFallback) return responseJson(request, env, { error: "affiliate_links_required", plan }, 409);
    const preflightConsumed = await planState(env).consumePlanPreflightToken(plan.id, input.preflightToken, plan.version);
    if (!preflightConsumed) return responseJson(request, env, { error: "preflight_required", plan }, 409);
    const created = await planState(env).createExecution(createCartExecution(plan));
    return responseJson(request, env, { execution: created.execution }, 201);
  }

  const executionMatch = url.pathname.match(/^\/api\/executions\/([0-9a-f-]{36})$/i);
  if (executionMatch && request.method === "GET") {
    const record = await planState(env).readExecution(executionMatch[1]);
    if (!record) return responseJson(request, env, { error: "not_found" }, 404);
    const byPlan = await planState(env).readPlan(record.execution.planId, bearer(request));
    const deviceState = stateFromOpaque(env, bearer(request));
    const deviceId = deviceState ? await deviceState.authenticateDevice(bearer(request)) : null;
    if (!byPlan && deviceId !== record.claimedDeviceId) return responseJson(request, env, { error: "not_found" }, 404);
    return responseJson(request, env, { execution: record.execution });
  }

  const executionClaimLink = url.pathname.match(/^\/api\/executions\/([0-9a-f-]{36})\/claim-link$/i);
  if (executionClaimLink && request.method === "POST") {
    const record = await planState(env).readExecution(executionClaimLink[1]);
    if (!record || !(await planState(env).readPlan(record.execution.planId, bearer(request)))) return responseJson(request, env, { error: "not_found" }, 404);
    const claim = await planState(env).issueExecutionClaimToken(record.execution.id);
    if (!claim) return responseJson(request, env, { error: "already_claimed_or_expired" }, 409);
    const appBase = (env.DDAKDAMA_APP_LINK_BASE ?? "ddakdama://execute").replace(/\/$/, "");
    return responseJson(request, env, { executionId: record.execution.id, expiresAt: claim.expiresAt, appLink: `${appBase}/${record.execution.id}?claim=${encodeURIComponent(claim.claimToken)}` });
  }

  const executionClaim = url.pathname.match(/^\/api\/executions\/([0-9a-f-]{36})\/claim$/i);
  if (executionClaim && request.method === "POST") {
    const token = bearer(request); const state = stateFromOpaque(env, token); const deviceId = state ? await state.authenticateDevice(token) : null;
    if (!deviceId) return responseJson(request, env, { error: "unauthorized" }, 401);
    const execution = await planState(env).claimExecution(executionClaim[1], executionClaimInput.parse(await readJson(request)).claimToken, deviceId);
    return responseJson(request, env, execution ? { execution } : { error: "invalid_or_expired_claim" }, execution ? 200 : 404);
  }

  const executionItem = url.pathname.match(/^\/api\/executions\/([0-9a-f-]{36})\/items\/([^/]+)$/i);
  if (executionItem && request.method === "PATCH") {
    const token = bearer(request); const state = stateFromOpaque(env, token); const deviceId = state ? await state.authenticateDevice(token) : null;
    if (!deviceId) return responseJson(request, env, { error: "unauthorized" }, 401);
    const input = executionItemUpdateInput.parse(await readJson(request));
    const execution = await planState(env).updateExecutionItem(executionItem[1], deviceId, executionItem[2], input.status, input.message);
    return responseJson(request, env, execution ? { execution } : { error: "not_found" }, execution ? 200 : 404);
  }

  const config = partnersConfig(env);
  if (request.method === "GET" && url.pathname === "/api/affiliate/status") {
    return responseJson(request, env, {
      configured: partnersConfigured(config),
      mode: "public-beta",
      disclosure:
        "쿠팡 파트너스 활동을 통해 일정액의 수수료를 받을 수 있습니다.",
    });
  }

  if (request.method === "POST" && url.pathname.startsWith("/api/affiliate/")) {
    const token = bearer(request);
    const state = stateFromOpaque(env, token);
    const deviceId = state ? await state.authenticateDevice(token) : null;
    if (!deviceId) {
      return responseJson(request, env, { error: "unauthorized" }, 401);
    }
    if (!partnersConfigured(config)) {
      return responseJson(
        request,
        env,
        {
          error: "PARTNERS_NOT_CONFIGURED",
          fallback: url.pathname.endsWith("search")
            ? "BROWSER_SEARCH"
            : "DIRECT_COUPANG_URL",
        },
        503,
      );
    }
    const body = await readJson(request);
    if (url.pathname.endsWith("/search")) {
      const input = searchInput.parse(body);
      return responseJson(request, env, {
        results: normalizeSearchPayload(
          await searchProducts(input.keyword, input.limit, config),
        ),
      });
    }
    if (url.pathname.endsWith("/deeplink")) {
      const input = deepLinkInput.parse(body);
      return responseJson(request, env, {
        links: normalizeDeepLinkPayload(
          await createDeepLinks(input.urls, config),
        ),
      });
    }
  }

  return responseJson(request, env, { error: "not_found" }, 404);
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext) {
    const url = new URL(request.url);
    try {
      if (url.pathname === "/health") {
        return new Response(
          JSON.stringify({
            ok: true,
            name: "ddakdama",
            version: "1.0.2",
            runtime: "cloudflare-workers",
            status: "available",
          }),
          { headers: jsonHeaders },
        );
      }

      if (url.pathname === "/gpt/actions.openapi.json") {
        return new Response(JSON.stringify(gptActionsOpenApi(url.origin)), {
          headers: {
            "content-type": "application/json; charset=utf-8",
            "cache-control": "public, max-age=300",
            "x-content-type-options": "nosniff",
          },
        });
      }

      if (url.pathname.startsWith("/api/")) {
        return await handleApi(request, env, url);
      }

      if (url.pathname === "/app" || url.pathname === "/app/") {
        return Response.redirect(`${url.origin}/${url.search}`, 302);
      }

      // Browser fallback for a shared plan link. The Android app handles the
      // one-time ddakdama:// claim link; this route lets an uninstalled device
      // continue in the same single web surface instead of reaching a dead end.
      const browserPlanLink = url.pathname.match(/^\/open\/plan\/([0-9a-f-]{36})$/i);
      if (browserPlanLink && request.method === "GET") {
        const target = new URL(url.origin);
        target.searchParams.set("plan", browserPlanLink[1]);
        const grant = url.searchParams.get("grant");
        if (grant) target.searchParams.set("grant", grant);
        return Response.redirect(target.toString(), 302);
      }

      if (url.pathname === "/mcp") {
        const server = createMcpServer({
          pairingClientKey: clientKey(request),
          store: createStore(env),
          widgetHtml,
          widgetUri: WIDGET_URI,
          legacyWidgetUris: LEGACY_WIDGET_URIS,
          widgetDomain: url.origin,
        });
        return createMcpHandler(server, {
          route: "/mcp",
          enableJsonResponse: true,
        })(request, env, ctx);
      }

      const publicPage =
        url.pathname === "/privacy"
          ? privacyPage
          : url.pathname === "/terms"
            ? termsPage
            : url.pathname === "/support"
              ? (icon: string) =>
                  supportPage(icon, {
                    submitted: url.searchParams.get("submitted") === "1",
                    ticketId: url.searchParams.get("ticket") ?? undefined,
                    rateLimited: url.searchParams.get("error") === "rate",
                  })
              : null;
      if (publicPage) {
        return new Response(publicPage(appIconDataUrl), {
          headers: {
            "content-type": "text/html; charset=utf-8",
            "cache-control": "public, max-age=300",
            "x-content-type-options": "nosniff",
            "content-security-policy": "default-src 'none'; img-src data:; style-src 'unsafe-inline'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'",
          },
        });
      }

      return env.ASSETS.fetch(request);
    } catch (error) {
      const invalidInput = error instanceof z.ZodError;
      const tooLarge = error instanceof Error && error.message === "BODY_TOO_LARGE";
      const clarificationRequired = error instanceof Error && error.message === "CLARIFICATION_REQUIRED";
      console.error("[ddakdama-worker]", {
        path: url.pathname,
        error: invalidInput
          ? "invalid_input"
          : tooLarge
            ? "body_too_large"
            : error instanceof Error
              ? error.message
              : "unknown",
      });
      return responseJson(
        request,
        env,
        {
          error: invalidInput
            ? "invalid_input"
            : tooLarge
              ? "body_too_large"
              : clarificationRequired
                ? "clarification_required"
              : "internal_error",
        },
        invalidInput ? 400 : tooLarge ? 413 : clarificationRequired ? 409 : 500,
      );
    }
  },
} satisfies ExportedHandler<Env>;
