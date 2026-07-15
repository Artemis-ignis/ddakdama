import { createMcpHandler } from "agents/mcp";
import { z } from "zod";
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
  landingPage,
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
  "access-control-allow-methods": "GET,POST,DELETE,OPTIONS",
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

const createStore = (env: Env): McpStore => ({
  async completePairing(code, pairingClientKey = "unknown") {
    const normalized = normalizePairingCode(code);
    if (!normalized) return null;
    if (!(await pairingRateState(env).allowPairingAttempt(pairingClientKey, 30))) {
      return null;
    }
    return stateForShard(env, normalized[0]).completePairing(
      normalized,
      pairingClientKey,
      ttl(env.CONNECTION_GRANT_TTL_SECONDS, 2_592_000),
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
});

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
            version: "1.0.0",
            runtime: "cloudflare-workers",
            status: "available",
          }),
          { headers: jsonHeaders },
        );
      }

      if (url.pathname.startsWith("/api/")) {
        return await handleApi(request, env, url);
      }

      if (url.pathname === "/mcp") {
        const server = createMcpServer({
          pairingClientKey: clientKey(request),
          store: createStore(env),
          widgetHtml,
          widgetUri: WIDGET_URI,
          legacyWidgetUris: LEGACY_WIDGET_URIS,
        });
        return createMcpHandler(server, {
          route: "/mcp",
          enableJsonResponse: true,
        })(request, env, ctx);
      }

      if (url.pathname === "/") {
        return new Response(landingPage(appIconDataUrl), {
          headers: {
            "content-type": "text/html; charset=utf-8",
            "cache-control": "public, max-age=300",
            "x-content-type-options": "nosniff",
            "content-security-policy": "default-src 'none'; img-src data:; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
          },
        });
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

      return new Response("Not Found", { status: 404 });
    } catch (error) {
      const invalidInput = error instanceof z.ZodError;
      const tooLarge = error instanceof Error && error.message === "BODY_TOO_LARGE";
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
              : "internal_error",
        },
        invalidInput ? 400 : tooLarge ? 413 : 500,
      );
    }
  },
} satisfies ExportedHandler<Env>;
