import { createHmac } from "node:crypto";
import { parseUnitsPerPackage } from "@ddakdama/core/product";

const base = "https://api-gateway.coupang.com";
const root = "/v2/providers/affiliate_open_api/apis/openapi/v1";

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

export const partnersConfig = (): PartnersConfig => ({
  accessKey: String(process.env.COUPANG_PARTNERS_ACCESS_KEY ?? "").trim(),
  secretKey: String(process.env.COUPANG_PARTNERS_SECRET_KEY ?? "").trim(),
  subId: String(process.env.COUPANG_PARTNERS_SUB_ID ?? "ddakdama-extension")
    .replace(/[^a-zA-Z0-9_-]/g, "-")
    .slice(0, 64),
});

export const partnersConfigured = (config = partnersConfig()) =>
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

export function authorization(
  method: string,
  pathWithQuery: string,
  config: PartnersConfig,
  date = new Date(),
) {
  if (!partnersConfigured(config)) throw new Error("PARTNERS_NOT_CONFIGURED");
  const [path, query = ""] = pathWithQuery.split("?");
  const stamp = signedDate(date);
  const signature = createHmac("sha256", config.secretKey)
    .update(stamp + method.toUpperCase() + path + query)
    .digest("hex");
  return `CEA algorithm=HmacSHA256, access-key=${config.accessKey}, signed-date=${stamp}, signature=${signature}`;
}

async function call(
  pathWithQuery: string,
  init: RequestInit,
  config = partnersConfig(),
) {
  const response = await fetch(base + pathWithQuery, {
    ...init,
    headers: {
      accept: "application/json",
      "content-type": "application/json; charset=utf-8",
      authorization: authorization(init.method ?? "GET", pathWithQuery, config),
      "user-agent": "ddakdama/1.0.2",
      ...(init.headers ?? {}),
    },
    signal: AbortSignal.timeout(8_000),
  });
  const payload: unknown = await response.json().catch(() => ({}));
  const body = record(payload);
  if (!response.ok || String(body.rCode ?? "0") !== "0") {
    throw new Error(
      String(body.rMessage ?? body.message ?? `PARTNERS_HTTP_${response.status}`),
    );
  }
  return payload;
}

export async function searchProducts(
  keyword: string,
  limit = 10,
  config = partnersConfig(),
) {
  const query = new URLSearchParams({
    keyword,
    limit: String(Math.max(1, Math.min(10, limit))),
    subId: config.subId,
  });
  return call(`${root}/products/search?${query}`, { method: "GET" }, config);
}

export async function createDeepLinks(
  urls: string[],
  config = partnersConfig(),
) {
  const coupangUrls = [...new Set(urls)]
    .filter((value) => {
      try {
        const url = new URL(value);
        return url.protocol === "https:" && /(^|\.)coupang\.com$/i.test(url.hostname);
      } catch {
        return false;
      }
    })
    .slice(0, 20);
  if (!coupangUrls.length) throw new Error("NO_VALID_COUPANG_URL");
  return call(
    `${root}/deeplink`,
    { method: "POST", body: JSON.stringify({ coupangUrls, subId: config.subId }) },
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
        // Some API results omit a usable URL; productId remains authoritative.
      }
      const productId = String(
        item.productId ??
          item.product_id ??
          url?.pathname.match(/products\/(\d+)/)?.[1] ??
          "",
      );
      const vendorItemId = url?.searchParams.get("vendorItemId") ?? null;
      const itemId = url?.searchParams.get("itemId") ?? null;
      const title = String(item.productName ?? item.product_name ?? "").trim();
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
        currentPrice: Number(item.productPrice ?? item.product_price) || null,
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
