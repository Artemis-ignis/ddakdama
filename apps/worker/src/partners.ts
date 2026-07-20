import { parseUnitsPerPackage } from "@ddakdama/core/product";

const API_BASE = "https://api-gateway.coupang.com";
const API_ROOT = "/v2/providers/affiliate_open_api/apis/openapi/v1";

export type PartnersConfig = {
  accessKey: string;
  secretKey: string;
  subId: string;
};

type JsonRecord = Record<string, unknown>;

const record = (value: unknown): JsonRecord =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonRecord)
    : {};

export const configured = (config: PartnersConfig) =>
  Boolean(config.accessKey && config.secretKey);

export function signedDate(date = new Date()) {
  const pad = (value: number) => String(value).padStart(2, "0");
  return (
    String(date.getUTCFullYear()).slice(-2) +
    pad(date.getUTCMonth() + 1) +
    pad(date.getUTCDate()) +
    "T" +
    pad(date.getUTCHours()) +
    pad(date.getUTCMinutes()) +
    pad(date.getUTCSeconds()) +
    "Z"
  );
}

export async function authorization(
  method: string,
  pathWithQuery: string,
  config: PartnersConfig,
  date = new Date(),
) {
  if (!configured(config)) throw new Error("PARTNERS_NOT_CONFIGURED");
  const [path, query = ""] = pathWithQuery.split("?");
  const stamp = signedDate(date);
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(config.secretKey),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(
      stamp + method.toUpperCase() + path + query,
    ),
  );
  const signatureHex = [...new Uint8Array(signature)]
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("");
  return `CEA algorithm=HmacSHA256, access-key=${config.accessKey}, signed-date=${stamp}, signature=${signatureHex}`;
}

async function call(
  pathWithQuery: string,
  init: RequestInit,
  config: PartnersConfig,
) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8_000);
  try {
    const response = await fetch(API_BASE + pathWithQuery, {
      ...init,
      headers: {
        accept: "application/json",
        "content-type": "application/json; charset=utf-8",
        authorization: await authorization(
          init.method ?? "GET",
          pathWithQuery,
          config,
        ),
        "user-agent": "ddakdama/1.0.2",
        ...(init.headers ?? {}),
      },
      signal: controller.signal,
    });
    const payload: unknown = await response.json().catch(() => ({}));
    const body = record(payload);
    if (!response.ok || String(body.rCode ?? "0") !== "0") {
      throw new Error(
        String(
          body.rMessage ??
            body.message ??
            `PARTNERS_HTTP_${response.status}`,
        ),
      );
    }
    return payload;
  } finally {
    clearTimeout(timeout);
  }
}

export async function searchProducts(
  keyword: string,
  limit: number,
  config: PartnersConfig,
) {
  const query = new URLSearchParams({
    keyword,
    limit: String(Math.max(1, Math.min(10, limit))),
    subId: config.subId,
  });
  return call(`${API_ROOT}/products/search?${query}`, { method: "GET" }, config);
}

export async function createDeepLinks(
  urls: string[],
  config: PartnersConfig,
) {
  const coupangUrls = [...new Set(urls)]
    .filter((value) => {
      try {
        const url = new URL(value);
        return (
          url.protocol === "https:" &&
          /(^|\.)coupang\.com$/i.test(url.hostname)
        );
      } catch {
        return false;
      }
    })
    .slice(0, 20);
  if (!coupangUrls.length) throw new Error("NO_VALID_COUPANG_URL");
  return call(
    `${API_ROOT}/deeplink`,
    {
      method: "POST",
      body: JSON.stringify({ coupangUrls, subId: config.subId }),
    },
    config,
  );
}

export function normalizeSearchPayload(payload: unknown) {
  const top = record(payload);
  const nested = record(top.data);
  const raw = Array.isArray(nested.productData)
    ? nested.productData
    : Array.isArray(top.data)
      ? top.data
      : [];

  return raw
    .map((value) => {
      const item = record(value);
      const rawUrl = String(item.productUrl ?? item.product_url ?? "");
      let url: URL | null = null;
      try {
        url = new URL(rawUrl);
      } catch {
        // Product id is still authoritative when a URL is absent.
      }
      const productId = String(
        item.productId ??
          item.product_id ??
          url?.pathname.match(/products\/(\d+)/)?.[1] ??
          "",
      );
      const vendorItemId = url?.searchParams.get("vendorItemId") ?? null;
      const itemId = url?.searchParams.get("itemId") ?? null;
      const title = String(
        item.productName ?? item.product_name ?? "",
      ).trim();
      const query = new URLSearchParams();
      if (itemId) query.set("itemId", itemId);
      if (vendorItemId) query.set("vendorItemId", vendorItemId);
      const productUrl = productId
        ? `https://www.coupang.com/vp/products/${productId}${query.size ? `?${query}` : ""}`
        : rawUrl;
      return {
        id: `${productId}-${vendorItemId ?? ""}`,
        productId,
        vendorItemId,
        itemId,
        title,
        currentPrice:
          Number(item.productPrice ?? item.product_price) || null,
        unitsPerPackage: parseUnitsPerPackage(title),
        productUrl,
        imageUrl: item.productImage ?? item.product_image ?? null,
        rocketDelivery: Boolean(item.isRocket ?? item.is_rocket),
        rating: null,
        reviewCount: null,
        advertised: false,
        source: "PARTNERS" as const,
      };
    })
    .filter((item) => item.productId && item.title && item.productUrl);
}

export function normalizeDeepLinkPayload(payload: unknown) {
  const data = record(payload).data;
  const raw = Array.isArray(data) ? data : [];
  return raw
    .map((value) => {
      const item = record(value);
      return {
        originalUrl: String(item.originalUrl ?? item.original_url ?? ""),
        shortenUrl: String(item.shortenUrl ?? item.shorten_url ?? ""),
        landingUrl: String(
          item.landingUrl ??
            item.landing_url ??
            item.shortenUrl ??
            item.shorten_url ??
            "",
        ),
      };
    })
    .filter((item) => item.originalUrl && item.landingUrl);
}
