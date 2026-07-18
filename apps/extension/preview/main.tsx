import React from "react";
import { createRoot } from "react-dom/client";
import { parseShoppingList } from "@ddakdama/core";
import { App, type PreviewState, type SearchGroup } from "../src/ui/App";
import "../src/ui/styles.css";
import "../src/ui/runtime.css";

const sample = `닥터지 레드 블레미쉬 포 맨 진정 올인원 150ml
스킨1004 히알루 시카 워터핏 선 세럼 50ml 2개
라운드랩 1025 독도 클렌저 150ml 2개
TS 골드플러스 샴푸 500g
닥터스베스트 고흡수 마그네슘 100mg 240정`;
const lines = parseShoppingList(sample);
const prices = [16_200, 10_900, 9_450, 11_540, 26_450];
const delay = (milliseconds: number) => new Promise((resolve) => window.setTimeout(resolve, milliseconds));

const groups: SearchGroup[] = lines.map((line, index) => ({
  requestLineId: line.id,
  results: [
    {
      id: `${index}-best`,
      productId: `1000${index}`,
      vendorItemId: `2000${index}`,
      itemId: null,
      title: `${line.productName} ${line.unitSizeValue ?? line.strengthValue}${line.unitSizeUnit ?? line.strengthUnit}${line.packageContentCount ? ` ${line.packageContentCount}${line.packageContentUnit}` : ""}`,
      currentPrice: prices[index],
      unitsPerPackage: index === 1 || index === 2 ? 2 : 1,
      productUrl: `https://www.coupang.com/vp/products/1000${index}?vendorItemId=2000${index}`,
      imageUrl: null,
      rocketDelivery: true,
      rating: 4.8,
      reviewCount: 1_200,
      advertised: false,
      source: "BROWSER",
    },
    {
      id: `${index}-single`,
      productId: `3000${index}`,
      vendorItemId: `4000${index}`,
      itemId: null,
      title: `${line.productName} ${line.unitSizeValue ?? line.strengthValue}${line.unitSizeUnit ?? line.strengthUnit}${line.packageContentCount ? ` ${line.packageContentCount}${line.packageContentUnit}` : ""} 단품`,
      currentPrice: Math.round(prices[index] * 0.58),
      unitsPerPackage: 1,
      productUrl: `https://www.coupang.com/vp/products/3000${index}?vendorItemId=4000${index}`,
      imageUrl: null,
      rocketDelivery: false,
      rating: 4.6,
      reviewCount: 430,
      advertised: false,
      source: "BROWSER",
    },
  ],
}));

const candidateByProductId = new Map(groups.flatMap((group) => group.results.map((candidate) => [candidate.productId, candidate])));
const success = lines.map((line, index) => ({
  id: line.id,
  status: "SUCCESS",
  beforeQuantity: 0,
  afterQuantity: line.requestedPhysicalUnits / (index === 1 || index === 2 ? 2 : 1),
  verifiedPrice: prices[index],
  cartPrice: prices[index],
  expectedSubtotal: prices[index] * (line.requestedPhysicalUnits / (index === 1 || index === 2 ? 2 : 1)),
  cartAddedSubtotal: prices[index] * (line.requestedPhysicalUnits / (index === 1 || index === 2 ? 2 : 1)),
}));
const corruptPrice = success.map((result, index) => index === 0
  ? { ...result, cartPrice: 1_501_502_320_004_716_800_000_000, cartAddedSubtotal: 1_501_502_320_004_716_800_000_000, priceDifference: 1_501_502_320_004_716_800_000_000 }
  : result);
const partial = lines.map((line, index) => index === 4
  ? { id: line.id, status: "PRICE_UNVERIFIED", beforeQuantity: 0, afterQuantity: 0 }
  : { ...success[index] });
const partialPreflight = lines.map((line, index) => ({
  id: line.id,
  status: index === 4 ? "PRICE_UNVERIFIED" : "READY",
  verifiedPrice: index === 4 ? undefined : prices[index],
}));
const readyPreflight = lines.map((line, index) => ({ id: line.id, status: "READY", verifiedPrice: prices[index] }));

const path = location.pathname;
const preview: PreviewState = path.includes("result-corrupt-price")
  ? { groups, step: 4, preflight: true, cartResults: corruptPrice, notice: "장바구니 금액 안전성 검사" }
  : path.includes("result-partial-failure")
    ? { groups, step: 4, preflight: true, cartResults: partial, notice: "성공 4종 · 실패 1종입니다. 실패 상품을 확인해 주세요." }
    : path.includes("result-success")
      ? { groups, step: 4, preflight: true, cartResults: success, notice: "요청한 상품 5종을 모두 검증해 담았습니다." }
      : path.includes("preflight-partial")
        ? { groups, step: 3, preflight: true, preflightResults: partialPreflight, notice: "사전검사 통과 4종 · 확인 필요 1종입니다." }
        : path.includes("preflight")
          ? { groups, step: 3, preflight: true, preflightResults: readyPreflight, notice: "상품 5종 · 실물 7개 · 예상 금액을 확인해 주세요." }
          : path.includes("candidates")
            ? { groups, step: 2, notice: "모든 상품의 실제 후보를 찾았습니다." }
            : {};
const themeParam = new URLSearchParams(location.search).get("theme");
if (themeParam === "light" || themeParam === "dark" || themeParam === "system") preview.theme = themeParam;

type DemoHandoff = { id: string; payload: { items?: Array<{ rawText?: string }> } };
let latestHandoff: DemoHandoff | null = null;
const storage = new Map<string, unknown>();
let pairingRequestCount = 0;
let pairingConnected = false;

window.addEventListener("message", (event) => {
  if (event.data?.type !== "DDAKDAMA_DEMO_HANDOFF") return;
  latestHandoff = event.data.handoff as DemoHandoff;
  pairingConnected = true;
});

(globalThis as typeof globalThis & { chrome: unknown }).chrome = {
  runtime: {
    sendMessage: async (message: { type: string; items?: unknown[]; jobs?: Array<{ id: string; productId: string; cartPurchaseQuantity: number }>; runId?: string }) => {
      window.parent.postMessage({ type: "DDAKDAMA_DEMO_RUNTIME", messageType: message.type }, "*");
      if (message.type === "DDAKDAMA_SEARCH_ALL") {
        await delay(850);
        const requestedIds = new Set((message.items ?? []).map((item) => String((item as { id?: string }).id ?? "")));
        return { ok: true, output: groups.filter((group) => requestedIds.has(group.requestLineId)) };
      }
      if (message.type === "DDAKDAMA_PREFLIGHT") {
        await delay(750);
        return {
          ok: true,
          results: (message.jobs ?? []).map((job) => ({
            id: job.id,
            status: "READY",
            verifiedPrice: candidateByProductId.get(job.productId)?.currentPrice,
          })),
        };
      }
      if (message.type === "DDAKDAMA_RUN_CART_JOBS") {
        await delay(1_000);
        return {
          ok: true,
          results: (message.jobs ?? []).map((job) => {
            const candidate = candidateByProductId.get(job.productId);
            const currentPrice = candidate?.currentPrice ?? 0;
            return {
              id: job.id,
              status: "SUCCESS",
              productId: job.productId,
              beforeQuantity: 0,
              afterQuantity: job.cartPurchaseQuantity,
              verifiedPrice: currentPrice,
              cartPrice: currentPrice,
              expectedSubtotal: currentPrice * job.cartPurchaseQuantity,
              cartAddedSubtotal: currentPrice * job.cartPurchaseQuantity,
              productUrl: candidate?.productUrl,
            };
          }),
        };
      }
      if (message.type === "DDAKDAMA_OPEN_CART") {
        document.documentElement.dataset.demoCartOpened = "true";
        window.parent.postMessage({ type: "DDAKDAMA_DEMO_CART_OPENED" }, "*");
      }
      return { ok: true };
    },
  },
  storage: {
    local: {
      get: async (keys: string[]) => Object.fromEntries(keys.map((key) => [key, storage.get(key)])),
      set: async (values: Record<string, unknown>) => {
        for (const [key, value] of Object.entries(values)) storage.set(key, value);
      },
      remove: async (keys: string[]) => {
        for (const key of keys) storage.delete(key);
      },
    },
  },
  tabs: { create: async () => ({}) },
};

globalThis.fetch = async (input, init) => {
  const url = String(input);
  if (url.endsWith("/api/pairing/start")) {
    pairingConnected = false;
    return new Response(JSON.stringify({
      code: pairingRequestCount++ === 0 ? "482731" : "927364",
      deviceId: "preview-device",
      deviceToken: "preview-token",
      expiresAt: Date.now() + 600_000,
    }), { status: 201, headers: { "content-type": "application/json" } });
  }
  if (url.endsWith("/api/pairing/status")) {
    return new Response(JSON.stringify({
      connected: pairingConnected,
      grantExpiresAt: pairingConnected ? Date.now() + 86_400_000 : null,
    }), { status: 200, headers: { "content-type": "application/json" } });
  }
  if (url.endsWith("/api/handoffs/latest")) {
    return new Response(JSON.stringify({ handoff: latestHandoff }), { status: 200, headers: { "content-type": "application/json" } });
  }
  if (/\/api\/handoffs\/[^/]+\/ack$/.test(url) && init?.method === "POST") {
    const handoffId = latestHandoff?.id;
    latestHandoff = null;
    window.parent.postMessage({ type: "DDAKDAMA_DEMO_ACK", handoffId }, "*");
    return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { "content-type": "application/json" } });
  }
  if (url.endsWith("/api/device/revoke") && init?.method === "POST") {
    pairingConnected = false;
    return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { "content-type": "application/json" } });
  }
  return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { "content-type": "application/json" } });
};

createRoot(document.getElementById("root")!).render(
  <React.StrictMode><App preview={preview} /></React.StrictMode>,
);
