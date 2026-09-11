import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  ArrowLeft,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  CircleHelp,
  ExternalLink,
  Link2,
  LoaderCircle,
  Minus,
  MinusCircle,
  Monitor,
  Moon,
  Plus,
  RefreshCw,
  Search,
  ShoppingBag,
  Sun,
  Unlink,
} from "lucide-react";
import { parseShoppingList, type ShoppingRequestLine } from "@ddakdama/core";
import brandIcon from "../../assets/icon-48.png";

import {
  candidateMatchesRequest,
  classifySearchCandidates,
  selectBestCandidate,
  selectDefaultCandidate,
} from "../candidate-selection.js";
import { SERVER_ORIGIN } from "../config.js";
import { PUBLIC_WEB_ORIGIN } from "../config.js";
import { isTrustedPlanLink } from "../config.js";
import { restorePlanRequest } from "../plan-import.js";

const SAMPLE = `닥터지 레드 블레미쉬 포 맨 진정 올인원 150ml
스킨1004 히알루 시카 워터핏 선 세럼 50ml 2개
라운드랩 1025 독도 클렌저 150ml 2개
TS 골드플러스 샴푸 500g
닥터스베스트 고흡수 마그네슘 100mg 240정`;

const AFFILIATE_ENABLED = import.meta.env.VITE_DDAKDAMA_AFFILIATE_ENABLED === "true";
const CHATGPT_APP_URL = import.meta.env.VITE_DDAKDAMA_CHATGPT_APP_URL?.trim() || "https://chatgpt.com/g/g-6a5ec60a6c308191bc5b342f67c2772d-ddagdama-syoping-doumi";
const EXTENSION_VERSION = import.meta.env.VITE_DDAKDAMA_EXTENSION_VERSION;
const CART_AUTOMATION_ENABLED = import.meta.env.VITE_DDAKDAMA_REAL_COUPANG_AUTOMATION_ENABLED !== "false";
const STEP_LABELS = ["목록", "상품 확인", "담기 전 확인", "완료"];

export type SearchCandidate = {
  id: string;
  productId: string;
  vendorItemId: string | null;
  itemId: string | null;
  title: string;
  currentPrice: number | null;
  unitsPerPackage: number;
  productUrl: string;
  canonicalUrl?: string;
  partnersSearchUrl?: string | null;
  affiliateUrl?: string | null;
  affiliateVerified?: boolean;
  shippingFee?: number | null;
  fulfillmentType?: "ROCKET" | "ROCKET_FRESH" | "SELLER_DELIVERY" | "ROCKET_DIRECT" | "UNKNOWN";
  deliveryPromise?: string | null;
  deliveryCertainty?: "CONFIRMED" | "CONDITIONAL" | "UNKNOWN";
  navigationUrl?: string;
  imageUrl: string | null;
  rocketDelivery: boolean;
  rating: number | null;
  reviewCount: number | null;
  advertised: boolean;
  source: "BROWSER" | "PARTNERS";
};

export type SearchGroup = { requestLineId: string; results: SearchCandidate[]; error?: string };

type PersistedPlanCandidate = {
  id: string;
  productId: string;
  vendorItemId: string | null;
  itemId: string | null;
  title: string;
  currentPrice: number | null;
  unitsPerPackage: number;
  canonicalUrl: string;
  partnersSearchUrl: string | null;
  affiliateUrl: string | null;
  affiliateVerified: boolean;
  imageUrl: string | null;
  fulfillmentType: SearchCandidate["fulfillmentType"];
  shippingFee: number | null;
  deliveryPromise: string | null;
  deliveryCertainty: SearchCandidate["deliveryCertainty"];
  source: string;
};

type PersistedPlan = {
  version: number;
  items: Array<{
    request: { rawText: string };
    candidates: PersistedPlanCandidate[];
    selectedCandidateId: string | null;
  }>;
};

const asExtensionCandidate = (candidate: PersistedPlanCandidate): SearchCandidate => ({
  id: candidate.id,
  productId: candidate.productId,
  vendorItemId: candidate.vendorItemId,
  itemId: candidate.itemId,
  title: candidate.title,
  currentPrice: candidate.currentPrice,
  unitsPerPackage: candidate.unitsPerPackage,
  productUrl: candidate.canonicalUrl,
  canonicalUrl: candidate.canonicalUrl,
  partnersSearchUrl: candidate.partnersSearchUrl,
  affiliateUrl: candidate.affiliateUrl,
  affiliateVerified: candidate.affiliateVerified,
  navigationUrl: candidate.affiliateVerified ? candidate.affiliateUrl ?? candidate.canonicalUrl : candidate.canonicalUrl,
  imageUrl: candidate.imageUrl,
  rocketDelivery: candidate.fulfillmentType === "ROCKET" || candidate.fulfillmentType === "ROCKET_FRESH" || candidate.fulfillmentType === "ROCKET_DIRECT",
  fulfillmentType: candidate.fulfillmentType,
  shippingFee: candidate.shippingFee,
  deliveryPromise: candidate.deliveryPromise,
  deliveryCertainty: candidate.deliveryCertainty,
  rating: null,
  reviewCount: null,
  advertised: false,
  source: candidate.source === "PARTNERS" ? "PARTNERS" : "BROWSER",
});

export type ThemeMode = "system" | "light" | "dark";
export type PreviewState = {
  groups?: SearchGroup[];
  step?: number;
  preflight?: boolean;
  preflightResults?: Array<{ id: string; status: string; verifiedPrice?: number }>;
  cartResults?: Array<{ id: string; status: string }>;
  excludedIds?: string[];
  notice?: string;
  theme?: ThemeMode;
};

type CartJob = {
  skipExisting?: boolean;
  selectNewOnly?: boolean;
  id: string;
  productUrl: string;
  canonicalUrl?: string;
  affiliateUrl?: string | null;
  affiliateVerified?: boolean;
  navigationUrl?: string;
  productId: string;
  vendorItemId: string | null;
  itemId: string | null;
  cartPurchaseQuantity: number;
  expectedBrand: string | null;
  expectedProductName: string;
  expectedUnitsPerPackage: number;
  expectedUnitSize: string | null;
  expectedStrength: string | null;
  expectedPackageContent: string | null;
  status: "QUEUED";
};

type CartResult = {
  skippedExisting?: boolean;
  selectionWarning?: boolean;
  id: string;
  status: string;
  productUrl?: string;
  expectedProductName?: string;
  verifiedTitle?: string;
  beforeQuantity?: number;
  afterQuantity?: number;
  verifiedPrice?: number;
  beforeCartPrice?: number;
  cartPrice?: number;
  expectedSubtotal?: number;
  cartAddedSubtotal?: number;
  priceDifference?: number;
  mismatchReasons?: string[];
};

type RecoverableJournal = { runId: string; jobs: CartJob[]; results: CartResult[] };
type PairingState = "idle" | "code" | "connected" | "unavailable";
type PairingStatus = { connected: boolean; grantExpiresAt: number | null };

const pairingStorageKeys = [
  "ddakdama-device-id",
  "ddakdama-device-token",
  "ddakdama-pairing-code",
  "ddakdama-pairing-expires-at",
] as const;

const fetchPairingStatus = async (token: string): Promise<PairingStatus> => {
  const response = await fetch(`${SERVER_ORIGIN}/api/pairing/status`, {
    headers: { authorization: `Bearer ${token}` },
  });
  if (response.status === 401) throw new Error("PAIRING_UNAUTHORIZED");
  if (!response.ok) throw new Error("PAIRING_STATUS_FAILED");
  const data = await response.json() as Partial<PairingStatus>;
  if (typeof data.connected !== "boolean") throw new Error("INVALID_PAIRING_STATUS");
  return {
    connected: data.connected,
    grantExpiresAt: typeof data.grantExpiresAt === "number" ? data.grantExpiresAt : null,
  };
};

const physicalUnits = (lines: ShoppingRequestLine[]) =>
  lines.reduce((sum, line) => sum + line.requestedPhysicalUnits, 0);

const stateLabel = (line: ShoppingRequestLine) => {
  const specification = line.strengthValue && line.strengthUnit
    ? `${line.strengthValue}${line.strengthUnit}`
    : line.unitSizeValue && line.unitSizeUnit
      ? `${line.unitSizeValue}${line.unitSizeUnit}`
      : "규격 미입력";
  const packageContent = line.packageContentCount && line.packageContentUnit
    ? `${line.packageContentCount}${line.packageContentUnit}`
    : null;
  return [specification, packageContent, `실물 ${line.requestedPhysicalUnits}개`].filter(Boolean).join(" · ");
};

const mismatchMessage = (reasons?: string[]) => {
  if (reasons?.includes("PRODUCT_URL") || reasons?.includes("PRODUCT_ID")) return "선택한 상품과 열린 상세페이지가 달라 다시 확인이 필요합니다.";
  if (reasons?.includes("VENDOR_ITEM_ID") || reasons?.includes("ITEM_ID")) return "선택한 판매 옵션이 바뀌어 다시 확인이 필요합니다.";
  if (reasons?.includes("UNITS_PER_PACKAGE")) return "선택한 묶음 수량과 상세페이지의 묶음 수량이 다릅니다.";
  if (reasons?.includes("UNIT_SIZE") || reasons?.includes("STRENGTH") || reasons?.includes("PACKAGE_CONTENT")) return "요청한 용량·함량과 상세페이지에 표시된 규격이 다릅니다.";
  if (reasons?.includes("TITLE")) return "검색 결과와 상세 상품명이 달라 확인이 필요합니다.";
  return "요청한 상품과 상세페이지의 상품이 일치하지 않습니다.";
};

const statusMessage = (status?: string, mismatchReasons?: string[]) =>
  status === "PRODUCT_MISMATCH" ? mismatchMessage(mismatchReasons) : ({
    PRICE_UNVERIFIED: "현재 판매가격을 확인하지 못해 자동으로 담지 않았습니다.",
    QUANTITY_MISMATCH: "요청한 수량과 실제 장바구니 수량이 달라 확인이 필요합니다.",
    OPTION_REQUIRED: "필수 옵션을 직접 선택해야 하는 상품입니다.",
    OUT_OF_STOCK: "상품 페이지에 품절 또는 재입고 알림이 표시됩니다.",
    MEMBERSHIP_REQUIRED: "쿠팡에 ‘로켓와우 신청하기’가 표시됩니다. 로그인 상태와 와우·로켓프레시 이용 조건을 확인해 주세요. 품절로 판정한 것은 아닙니다.",
    PURCHASE_UNAVAILABLE: "장바구니 버튼을 확인하지 못했습니다. 배송지·구매 조건을 상품 페이지에서 확인해 주세요.",
    CHECKING: "현재 가격·규격·구매 조건을 확인하고 있습니다.",
    LOGIN_REQUIRED: "쿠팡 로그인이 필요합니다.",
    SECURITY_CHECK_REQUIRED: "쿠팡의 보안 확인이 필요합니다.",
    CART_VERIFICATION_FAILED: "장바구니 수량 변화를 확인하지 못했습니다.",
    NETWORK_ERROR: "상품 페이지의 응답이 늦어 확인을 완료하지 못했습니다. 장바구니는 변경하지 않았습니다.",
    CONTENT_SCRIPT_UNAVAILABLE: "상품 상세페이지와 연결하지 못했습니다. 장바구니는 변경하지 않았습니다.",
    PRODUCT_DETAIL_UNAVAILABLE: "상품 상세정보를 읽지 못했습니다. 장바구니는 변경하지 않았습니다.",
  })[status ?? ""] ?? "상품을 담지 못했습니다.";

const searchErrorMessage = (error?: string) =>
  ({
    CART_AUTOMATION_DISABLED: "공개 베타에서는 자동 검색을 제공하지 않습니다. 쿠팡 검색을 직접 열어 확인해 주세요.",
    SECURITY_CHECK_REQUIRED: "쿠팡에서 접근을 제한해 검색을 멈췄습니다. 열린 쿠팡 탭에서 화면을 확인해 주세요. 자동으로 반복 요청하지 않습니다.",
    LOGIN_REQUIRED: "쿠팡 로그인이 필요해 검색을 멈췄습니다. 열린 쿠팡 탭에서 로그인한 뒤 다시 찾기를 눌러 주세요.",
    DOM_PARSE_FAILED: "쿠팡 검색 화면을 읽지 못했습니다.",
    NO_RESULTS: "일치하는 검색 결과를 찾지 못했습니다.",
    CONTENT_SCRIPT_UNAVAILABLE: "쿠팡 검색 연결이 늦어지고 있습니다.",
    SEARCH_FORM_UNAVAILABLE: "쿠팡 검색창을 찾지 못했습니다. 열린 쿠팡 탭에서 직접 검색한 뒤 다시 찾기를 눌러 주세요.",
    SEARCH_TIMEOUT: "쿠팡 검색 결과가 제시간에 열리지 않아 검색을 멈췄습니다. 열린 탭을 확인해 주세요.",
    SEARCH_INTERRUPTED: "검색 탭이 다른 페이지로 이동해 작업을 멈췄습니다. 목록은 그대로 유지됩니다.",
    SEARCH_IN_PROGRESS: "이미 상품을 찾고 있습니다. 진행 중인 검색이 끝날 때까지 기다려 주세요.",
  })[error ?? ""] ?? "상품 검색을 완료하지 못했습니다.";

const searchErrorLabel = (error?: string) => ({
  SECURITY_CHECK_REQUIRED: "쿠팡 접근 제한", LOGIN_REQUIRED: "로그인 필요",
  NO_RESULTS: "검색 결과 없음", SEARCH_IN_PROGRESS: "검색 중",
})[error ?? ""] ?? "검색 확인 필요";

const candidateState = (line: ShoppingRequestLine, results: SearchCandidate[]) => {
  const level = classifySearchCandidates(line, results);
  if (level === "NONE") return "검색 결과 없음";
  const exact = selectBestCandidate(line, results);
  if (exact?.currentPrice === null) return "가격 확인 필요";
  return level === "EXACT" ? "정확한 후보 확인" : `후보 ${results.length}개 보기 · 규격 확인 필요`;
};

const purchaseQuantity = (line: ShoppingRequestLine, item: SearchCandidate, manuallySelected = false) =>
  manuallySelected || !candidateMatchesRequest(line, item)
    ? Math.ceil(line.requestedPhysicalUnits / item.unitsPerPackage)
    : line.requestedPhysicalUnits / item.unitsPerPackage;

const priceBreakdown = (price: number, line: ShoppingRequestLine, item: SearchCandidate, manuallySelected = false) => {
  const quantity = purchaseQuantity(line, item, manuallySelected);
  const subtotal = price * quantity;
  return quantity > 1
    ? `${price.toLocaleString()}원 × ${quantity}개 = ${subtotal.toLocaleString()}원`
    : `${subtotal.toLocaleString()}원`;
};

const plausibleCartSubtotal = (result: CartResult) => {
  const value = result.cartAddedSubtotal;
  if (!Number.isSafeInteger(value) || Number(value) < 0 || Number(value) > 1_000_000_000) return undefined;
  const expected = result.expectedSubtotal;
  if (expected !== undefined && value! > Math.max(expected * 3, expected + 100_000)) return undefined;
  return value;
};

const normalizeSpecText = (value: string) => value.toLowerCase().replace(/[^0-9a-z가-힣]/gu, "");

const manualSelectionWarnings = (line: ShoppingRequestLine, item: SearchCandidate) => {
  const title = normalizeSpecText(item.title);
  const warnings: string[] = [];
  const addSpecWarning = (label: string, value: number | null, unit: string | null) => {
    if (value && unit && !title.includes(normalizeSpecText(`${value}${unit}`))) warnings.push(`${label} 불일치 · 요청 ${value}${unit}`);
  };
  addSpecWarning("용량", line.unitSizeValue, line.unitSizeUnit);
  addSpecWarning("함량", line.strengthValue, line.strengthUnit);
  addSpecWarning("구성", line.packageContentCount, line.packageContentUnit);
  const quantity = Math.ceil(line.requestedPhysicalUnits / item.unitsPerPackage);
  const supplied = quantity * item.unitsPerPackage;
  if (supplied !== line.requestedPhysicalUnits) {
    warnings.push(`묶음 수량 불일치 · ${item.unitsPerPackage}개 묶음 ${quantity}세트로 실물 ${supplied}개 (${supplied - line.requestedPhysicalUnits}개 초과)`);
  }
  if (!warnings.length && !candidateMatchesRequest(line, item)) warnings.push("상품명 또는 세부 규격이 요청과 다를 수 있음");
  return warnings;
};

const resultMessage = (result: CartResult, line?: ShoppingRequestLine, item?: SearchCandidate | null, manuallySelected = false) => {
  if(result.skippedExisting)return `기존 ${result.beforeQuantity ?? 0}개 유지 · 중복으로 담지 않았습니다.${result.selectionWarning ? " 체크 상태는 쿠팡에서 확인해 주세요." : ""}`;
  if (result.status !== "SUCCESS") return statusMessage(result.status, result.mismatchReasons);
  if (!line || !item) return "요청한 수량을 장바구니에서 확인했습니다.";
  const quantity = purchaseQuantity(line, item, manuallySelected);
  const packageLabel = item.unitsPerPackage > 1
    ? `${item.unitsPerPackage}개 묶음 ${quantity}세트 담음`
    : `단품 ${quantity}개 담음`;
  const suppliedUnits = quantity * item.unitsPerPackage;
  const parts = [`${packageLabel} · 실물 ${suppliedUnits}개${suppliedUnits !== line.requestedPhysicalUnits ? ` (요청 ${line.requestedPhysicalUnits}개)` : ""}`];
  const verifiedSubtotal = result.expectedSubtotal ?? (result.verifiedPrice ? result.verifiedPrice * quantity : null);
  if (verifiedSubtotal !== null) parts.push(`확인가 ${verifiedSubtotal.toLocaleString()}원`);
  const cartSubtotal = plausibleCartSubtotal(result);
  if (cartSubtotal !== undefined && cartSubtotal !== verifiedSubtotal) parts.push(`장바구니 확인 ${cartSubtotal.toLocaleString()}원`);
  if (cartSubtotal !== undefined && verifiedSubtotal !== null && cartSubtotal !== verifiedSubtotal) {
    const difference = cartSubtotal - verifiedSubtotal;
    parts.push(`차액 ${difference > 0 ? "+" : ""}${difference.toLocaleString()}원`);
  }
  return parts.join(" · ");
};

function StepProgress({ step }: { step: number }) {
  return (
    <nav className="step-progress" aria-label="진행 단계">
      <div className="step-progress-copy">
        <strong>{STEP_LABELS[step - 1]}</strong>
        <span>{step} / 4</span>
      </div>
      <div className="step-progress-track" aria-hidden="true">
        <span style={{ width: `${step * 25}%` }} />
      </div>
      <div className="step-progress-labels">
        {STEP_LABELS.map((label, index) => (
          <span key={label} className={index + 1 === step ? "current" : index + 1 < step ? "done" : ""} aria-current={index + 1 === step ? "step" : undefined}>
            {label}
          </span>
        ))}
      </div>
    </nav>
  );
}

function ProductImage({ item }: { item: SearchCandidate | null }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [item?.imageUrl]);
  return item?.imageUrl && !failed
    ? <img className="product-image" src={item.imageUrl} alt="" referrerPolicy="no-referrer" onError={() => setFailed(true)} />
    : <span className="product-image placeholder" aria-hidden="true"><ShoppingBag size={19} /></span>;
}

export function App({ preview }: { preview?: PreviewState } = {}) {
  const initialInput = (preview?.step ?? 1) > 1 ? SAMPLE : "";
  const [input, setInput] = useState(initialInput);
  const [appendInput, setAppendInput] = useState("");
  const [lines, setLines] = useState(() => parseShoppingList(initialInput));
  const [expanded, setExpanded] = useState(-1);
  const [step, setStep] = useState(preview?.step ?? 1);
  const [notice, setNotice] = useState<string | null>(preview?.notice ?? null);
  const [groups, setGroups] = useState<SearchGroup[]>(preview?.groups ?? []);
  const [selectedIds, setSelectedIds] = useState<Record<string, string>>({});
  const [pendingIncomingPlan, setPendingIncomingPlan] = useState<string | null>(null);
  const lastAutoImportedPlan = useRef<string | null>(null);
  const incomingPlanBusy = useRef(false);
  const incomingGptBusy = useRef(false);
  const [excludedIds, setExcludedIds] = useState<Record<string, boolean>>(() =>
    Object.fromEntries((preview?.excludedIds ?? []).map((id) => [id, true])),
  );
  const [searchQueries, setSearchQueries] = useState<Record<string, string>>({});
  const [searchingLineId, setSearchingLineId] = useState<string | null>(null);
  const [searching, setSearching] = useState(false);
  const [preflight, setPreflight] = useState(preview?.preflight ?? false);
  const [preflightResults, setPreflightResults] = useState<CartResult[]>(
    preview?.preflightResults ?? (preview?.preflight ? lines.map((line) => ({ id: line.id, status: "READY" })) : []),
  );
  const [adding, setAdding] = useState(false);
  const [cartResults, setCartResults] = useState<CartResult[]>(preview?.cartResults ?? []);
  const [pairingCode, setPairingCode] = useState<string | null>(null);
  const [pairingExpiresAt, setPairingExpiresAt] = useState<number | null>(null);
  const [pairingState, setPairingState] = useState<PairingState>("idle");
  const [pairingBusy, setPairingBusy] = useState(false);
  const [planLinkInput, setPlanLinkInput] = useState("");
  const [planLinkBusy, setPlanLinkBusy] = useState(false);
  const [recoverable, setRecoverable] = useState<RecoverableJournal | null>(null);
  const [theme, setTheme] = useState<ThemeMode>(preview?.theme ?? "system");
  const cartRunId = useRef<string | null>(null);
  const [restored, setRestored] = useState(Boolean(preview));
  const [shareLink, setShareLink] = useState("");
  const [shareBusy, setShareBusy] = useState(false);
  const [shopLogin, setShopLogin] = useState("UNKNOWN");
  const checkShopLogin = async () => {
    setShopLogin("CHECKING");
    try { const result = await chrome.runtime.sendMessage({type:"DDAKDAMA_CHECK_COUPANG_LOGIN"}); setShopLogin(result?.status ?? "UNKNOWN"); }
    catch { setShopLogin("UNKNOWN"); }
  };
  const saveQueue = useRef(Promise.resolve());
  useEffect(() => {
    if (preview) return;
    const refresh = () => { if (document.visibilityState === "visible") void checkShopLogin(); };
    refresh(); window.addEventListener("focus", refresh);
    return () => window.removeEventListener("focus", refresh);
  }, [preview]);
  useEffect(() => {
    if (preview) return;
    let cancelled = false;
    void chrome.storage.local.get("ddakdama-workspace-v1").then(stored => {
      if (cancelled) return;
      const saved = stored["ddakdama-workspace-v1"] as {version:number;at:number;input:string;lines:ShoppingRequestLine[];groups:SearchGroup[];selectedIds:Record<string,string>;excludedIds:Record<string,boolean>;searchQueries:Record<string,string>;cartResults:CartResult[];step:number;busy?:boolean}|undefined;
      if (!saved || saved.version !== 1 || Date.now() - saved.at > 86_400_000 || !Array.isArray(saved.lines) || typeof saved.input !== "string") return;
      setInput(saved.input); setLines(saved.lines); setGroups(saved.groups ?? []);
      setSelectedIds(saved.selectedIds ?? {}); setExcludedIds(saved.excludedIds ?? {});
      setSearchQueries(saved.searchQueries ?? {}); setCartResults(saved.cartResults ?? []);
      // Restoring is not approval to replay searches or cart clicks. Recheck
      // current prices before any new execution; interrupted runs use journal.
      setStep(saved.busy ? 1 : saved.step === 4 ? 4 : saved.step > 1 ? 2 : 1);
      setNotice("이전 목록과 선택을 복원했습니다. 담기 전 가격·구매 조건은 다시 확인합니다.");
    }).catch(() => undefined).finally(() => { if (!cancelled) setRestored(true); });
    return () => { cancelled = true; };
  }, [preview]);
  useEffect(() => {
    if (!restored || preview) return;
    const saved = { version:1, at:Date.now(), input, lines, groups, selectedIds, excludedIds, searchQueries, cartResults, step, busy:adding || searching };
    saveQueue.current = saveQueue.current.catch(() => undefined).then(() => chrome.storage.local.set({"ddakdama-workspace-v1":saved}));
  }, [restored, preview, input, lines, groups, selectedIds, excludedIds, searchQueries, cartResults, step, adding, searching]);

  useEffect(() => {
    if (preview?.theme || typeof chrome === "undefined" || !chrome.storage?.local) return;
    void chrome.storage.local.get(["ddakdama-theme"]).then((stored) => {
      const saved = stored["ddakdama-theme"];
      if (saved === "light" || saved === "dark" || saved === "system") setTheme(saved);
    }).catch(() => undefined);
  }, [preview?.theme]);

  useEffect(() => {
    const root = document.documentElement;
    if (theme === "system") delete root.dataset.theme;
    else root.dataset.theme = theme;
    root.style.colorScheme = theme === "system" ? "light dark" : theme;
    if (!preview?.theme && typeof chrome !== "undefined" && chrome.storage?.local) {
      void chrome.storage.local.set({ "ddakdama-theme": theme }).catch(() => undefined);
    }
  }, [preview?.theme, theme]);


  useEffect(() => {
    if (typeof chrome === "undefined" || !chrome.runtime?.sendMessage) return;
    let cancelled = false;
    void chrome.runtime.sendMessage({ type: "DDAKDAMA_GET_CART_JOURNAL" })
      .then((response) => setRecoverable(response?.journal ?? null))
      .catch(() => undefined);
    void chrome.storage.local.get([...pairingStorageKeys]).then(async (stored) => {
      const token = String(stored["ddakdama-device-token"] ?? "");
      if (!token || cancelled) return;
      const code = String(stored["ddakdama-pairing-code"] ?? "");
      const expiresAt = Number(stored["ddakdama-pairing-expires-at"] ?? 0);
      const activeCode = /^\d{6}$/.test(code) && expiresAt > Date.now();
      if (activeCode) {
        setPairingCode(code);
        setPairingExpiresAt(expiresAt);
        setPairingState("code");
      } else if (code) {
        await chrome.storage.local.remove(["ddakdama-pairing-code", "ddakdama-pairing-expires-at"]);
      }
      try {
        const status = await fetchPairingStatus(token);
        if (cancelled) return;
        if (status.connected) {
          await chrome.storage.local.remove(["ddakdama-pairing-code", "ddakdama-pairing-expires-at"]);
          setPairingCode(null);
          setPairingExpiresAt(null);
          setPairingState("connected");
        } else if (!activeCode) {
          await chrome.storage.local.remove([...pairingStorageKeys]);
          setPairingState("idle");
        }
      } catch {
        if (!cancelled && !activeCode) setPairingState("unavailable");
      }
    }).catch(() => {
      if (!cancelled) setPairingState("unavailable");
    });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (pairingState !== "code" || !pairingExpiresAt) return;
    const remaining = pairingExpiresAt - Date.now();
    const expirePairing = () => {
      void chrome.storage.local.remove(["ddakdama-pairing-code", "ddakdama-pairing-expires-at"]);
      setPairingCode(null);
      setPairingExpiresAt(null);
      setPairingState("idle");
      setNotice("연결 코드가 만료됐습니다. 새 6자리 코드를 만들어 주세요.");
    };
    if (remaining <= 0) {
      expirePairing();
      return;
    }
    const timer = window.setTimeout(expirePairing, remaining);
    return () => window.clearTimeout(timer);
  }, [pairingExpiresAt, pairingState]);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(null), 5_500);
    return () => window.clearTimeout(timer);
  }, [notice]);

  const selected = useMemo(
    () => Object.fromEntries(lines.map((line) => {
      const results = groups.find((group) => group.requestLineId === line.id)?.results ?? [];
      const manuallySelected = results.find((item) => item.id === selectedIds[line.id]);
      return [line.id, manuallySelected ?? selectDefaultCandidate(line, results)];
    })) as Record<string, SearchCandidate | null>,
    [lines, groups, selectedIds],
  );

  const activeLines = useMemo(() => lines.filter((line) => !excludedIds[line.id]), [lines, excludedIds]);
  const activeLineIds = useMemo(() => new Set(activeLines.map((line) => line.id)), [activeLines]);
  const excludedCount = lines.length - activeLines.length;
  const selectedCount = activeLines.filter((line) => selected[line.id]).length;
  const defaultReviewCount = activeLines.filter((line) => {
    const item = selected[line.id];
    return item && selectedIds[line.id] !== item.id && !candidateMatchesRequest(line, item);
  }).length;
  const pricedSelectedCount = activeLines.filter((line) => Number(selected[line.id]?.currentPrice) > 0).length;
  const searchTotal = activeLines.reduce((sum, line) => {
    const item = selected[line.id];
    const manuallySelected = Boolean(item && selectedIds[line.id] === item.id);
    return sum + (item?.currentPrice ?? 0) * (item ? purchaseQuantity(line, item, manuallySelected) : 0);
  }, 0);
  const preflightReadyCount = preflightResults.filter((result) => activeLineIds.has(result.id) && result.status === "READY").length;
  const preflightIssueCount = preflightResults.filter((result) => activeLineIds.has(result.id) && result.status !== "READY").length;
  const preflightReadyIds = new Set(preflightResults.filter((result) => activeLineIds.has(result.id) && result.status === "READY").map((result) => result.id));
  const preflightReadyPhysicalUnits = activeLines.reduce((sum, line) => {
    const item = selected[line.id];
    return sum + (item && preflightReadyIds.has(line.id) ? purchaseQuantity(line, item, selectedIds[line.id] === item.id) * item.unitsPerPackage : 0);
  }, 0);
  const verifiedTotal = preflightResults.reduce((sum, result) => {
    if (!activeLineIds.has(result.id) || result.status !== "READY") return sum;
    const line = activeLines.find((candidate) => candidate.id === result.id);
    const item = selected[result.id];
    if (!line || !item) return sum;
    return sum + (result.verifiedPrice ?? 0) * purchaseQuantity(line, item, selectedIds[line.id] === item.id);
  }, 0);
  const completedSuccessResults = cartResults.filter((result) => result.status === "SUCCESS");
  const completedVerifiedTotal = completedSuccessResults.reduce((sum, result) => {
    if (result.expectedSubtotal !== undefined) return sum + result.expectedSubtotal;
    const line = lines.find((candidate) => candidate.id === result.id);
    const item = selected[result.id];
    if (!line || !item || !result.verifiedPrice) return sum;
    return sum + result.verifiedPrice * purchaseQuantity(line, item, selectedIds[line.id] === item.id);
  }, 0);
  const completedCartTotalKnown = completedSuccessResults.length > 0
    && completedSuccessResults.every((result) => plausibleCartSubtotal(result) !== undefined);
  const completedCartTotal = completedSuccessResults.reduce((sum, result) => sum + (plausibleCartSubtotal(result) ?? 0), 0);

  const displayProductTitle = (line?: ShoppingRequestLine, result?: CartResult, item?: SearchCandidate | null) =>
    result?.verifiedTitle?.trim()
    || result?.expectedProductName?.trim()
    || item?.title?.trim()
    || line?.productName
    || result?.id
    || "상품";

  const resetAfterInput = (nextLines: ShoppingRequestLine[]) => {
    cartRunId.current = null;
    setLines(nextLines);
    setGroups([]);
    setSelectedIds({});
    setExcludedIds({});
    setSearchQueries({});
    setSearchingLineId(null);
    setPreflight(false);
    setPreflightResults([]);
    setCartResults([]);
    setExpanded(-1);
    setStep(1);
  };

  const parseOnly = () => {
    const next = parseShoppingList(input);
    resetAfterInput(next);
    const sourceLines = input.split(/\r?\n/).filter((value) => value.trim()).length;
    setNotice(sourceLines === 0
      ? "상품 목록을 한 줄에 하나씩 입력해 주세요."
      : next.length === sourceLines
        ? `상품 ${next.length}종 · 실물 ${physicalUnits(next)}개로 정확히 나눴습니다.`
        : "일부 줄을 인식하지 못했습니다. 목록을 다시 확인해 주세요.");
  };

  /** Import an explicit, short-lived DdakDama web plan link. This makes the
   * Chrome surface useful on its own and avoids exposing any server details
   * or pairing codes to ordinary GPTs users. */
  const importPlanLink = async (sharedPlanUrl = planLinkInput) => {
    const rawUrl = sharedPlanUrl.trim();
    if (!rawUrl || planLinkBusy) return;
    setPlanLinkBusy(true);
    try {
      const link = new URL(rawUrl);
      if (!isTrustedPlanLink(rawUrl)) throw new Error("INVALID_PLAN_LINK");
      const planId = link.searchParams.get("plan");
      const grant = link.searchParams.get("grant");
      if (!planId || !grant) throw new Error("INVALID_PLAN_LINK");
      const planResponse = await fetch(`${link.origin}/api/plans/${encodeURIComponent(planId)}`, {
        headers: { authorization: `Bearer ${grant}` },
        redirect: "error",
      });
      if (!planResponse.ok) throw new Error("PLAN_LINK_EXPIRED");
      const planData = await planResponse.json() as { plan?: PersistedPlan };
      const persisted = planData.plan;
      const planLines = persisted?.items.map((item) => restorePlanRequest(item.request)) ?? [];
      const planRaw = planLines.map((line) => line.rawText).join("\n");
      if (!persisted || planLines.length === 0 || planLines.length !== persisted.items.length) throw new Error("INVALID_PLAN");
      setInput(planRaw);
      resetAfterInput(planLines);
      setGroups(persisted.items.map((item, index) => ({
        requestLineId: planLines[index]!.id,
        results: item.candidates.map(asExtensionCandidate),
      })));
      setSelectedIds(Object.fromEntries(persisted.items.flatMap((item, index) => {
        const selected = item.candidates.find((candidate) => candidate.id === item.selectedCandidateId);
        return selected ? [[planLines[index]!.id, selected.id]] : [];
      })));
      setStep(persisted.items.every((item) => item.selectedCandidateId) ? 2 : 1);
      setPlanLinkInput("");
      setPendingIncomingPlan((current) => current === rawUrl ? null : current);
      const pending = await chrome.storage.local.get("ddakdama-pending-plan-link");
      if (pending["ddakdama-pending-plan-link"] === rawUrl) await chrome.storage.local.remove("ddakdama-pending-plan-link");
      setNotice("딱담아에서 만든 쇼핑 계획을 불러왔습니다. 상품과 수량을 다시 확인해 주세요.");
    } catch (error) {
      setNotice(error instanceof Error && error.message === "PLAN_LINK_EXPIRED"
        ? "계획 링크가 만료됐습니다. 딱담아 웹 또는 GPTs에서 새 링크를 만들어 주세요."
        : "딱담아 계획 링크를 확인하지 못했습니다. 전체 링크를 다시 붙여넣어 주세요.");
    } finally {
      setPlanLinkBusy(false);
    }
  };

  useEffect(() => {
    if (!restored || typeof chrome === "undefined" || !chrome.storage?.local) return;
    let cancelled = false;
    const receive = (value: unknown) => {
      if (cancelled || !isTrustedPlanLink(value)) return;
      if (incomingPlanBusy.current) {
        if (lastAutoImportedPlan.current !== value) setPendingIncomingPlan(value);
        return;
      }
      if (adding || searching || planLinkBusy || lines.length || lastAutoImportedPlan.current === value) {
        setPendingIncomingPlan(value);
        return;
      }
      lastAutoImportedPlan.current = value;
      incomingPlanBusy.current = true;
      void importPlanLink(value).finally(() => { incomingPlanBusy.current = false; });
    };
    // Subscribe before the initial read so a plan arriving in that interval is
    // not lost. Never re-run shopping/cart actions from a storage notification.
    const onChanged = (changes: Record<string, chrome.storage.StorageChange>, area: string) => {
      if (area === "local") receive(changes["ddakdama-pending-plan-link"]?.newValue);
    };
    chrome.storage.onChanged.addListener(onChanged);
    void chrome.storage.local.get("ddakdama-pending-plan-link")
      .then((stored) => receive(stored["ddakdama-pending-plan-link"]))
      .catch(() => undefined);
    return () => { cancelled = true; chrome.storage.onChanged.removeListener(onChanged); };
  }, [restored, adding, searching, planLinkBusy, lines.length]);

  const searchPreparedLines = async (next: ShoppingRequestLine[]) => {
    resetAfterInput(next);
    if (!next.length) {
      setNotice("상품 목록을 한 줄에 하나씩 입력해 주세요.");
      return;
    }
    setSearching(true);
    setNotice(null);
    try {
      if (typeof chrome === "undefined" || !chrome.runtime?.sendMessage) {
        setNotice("Chrome 확장 프로그램에서 실제 상품 검색을 사용할 수 있습니다.");
        return;
      }
      const response = await chrome.runtime.sendMessage({ type: "DDAKDAMA_SEARCH_ALL", items: next });
      if (!response?.ok || !Array.isArray(response.output)) throw new Error(response?.error ?? "SEARCH_FAILED");
      const output = response.output as SearchGroup[];
      const requestedIds = new Set(next.map((line) => line.id));
      const outputIds = new Set(output.map((group) => group.requestLineId));
      if (output.length !== next.length || [...requestedIds].some((id) => !outputIds.has(id))) throw new Error("INCOMPLETE_SEARCH_RESPONSE");
      setGroups(output);
      setSelectedIds({});
      setStep(2);
      const exact = next.filter((line) => selectBestCandidate(line, output.find((group) => group.requestLineId === line.id)?.results ?? [])).length;
      setExpanded(next.findIndex((line) => !selectBestCandidate(line, output.find((group) => group.requestLineId === line.id)?.results ?? [])));
      const blocked = output.find((group) => group.error && group.error !== "NO_RESULTS");
      setNotice(blocked ? searchErrorMessage(blocked.error) : exact === next.length
        ? "요청한 규격과 수량이 정확히 일치하는 상품을 찾았습니다."
        : `정확히 일치하는 상품 ${exact}종 · 직접 확인이 필요한 상품 ${next.length - exact}종입니다.`);
    } catch (error) {
      setNotice(error instanceof Error && error.message === "CART_AUTOMATION_DISABLED"
        ? "공개 베타에서는 자동 검색을 실행하지 않습니다. 아래 ‘직접 쿠팡에서 검색’으로 상품을 확인해 주세요."
        : "쿠팡 검색을 완료하지 못했습니다. 잠시 후 다시 시도해 주세요.");
    } finally {
      setSearching(false);
    }
  };

  const searchAll = () => searchPreparedLines(parseShoppingList(input));

  const openManualReview = () => {
    if (!lines.length) return;
    setGroups(lines.map((line) => ({
      requestLineId: line.id,
      results: [],
      error: "CART_AUTOMATION_DISABLED",
    })));
    setSelectedIds({});
    setExpanded(0);
    setStep(2);
    setNotice("각 항목의 ‘직접 쿠팡에서 검색’을 눌러 상품·가격·배송 조건을 확인해 주세요.");
  };

  const makeJobs = (confirmedSelections = selectedIds): CartJob[] => activeLines.flatMap((line) => {
    const item = selected[line.id];
    if (!item) return [];
    const manuallySelected = confirmedSelections[line.id] === item.id;
    return [{
      skipExisting:true,
      selectNewOnly:true,
      id: line.id,
      productUrl: item.productUrl,
      canonicalUrl: item.canonicalUrl ?? item.productUrl,
      affiliateUrl: item.affiliateUrl ?? null,
      affiliateVerified: Boolean(item.affiliateVerified),
      navigationUrl: item.navigationUrl,
      productId: item.productId,
      vendorItemId: item.vendorItemId,
      itemId: item.itemId,
      cartPurchaseQuantity: purchaseQuantity(line, item, manuallySelected),
      expectedBrand: manuallySelected ? null : line.brand,
      // 상세페이지 검증은 사용자가 실제로 선택한 검색 후보를 기준으로 합니다.
      // 원문 오탈자나 검색/상세 제목의 판촉 문구 차이를 상품 불일치로 오판하지 않습니다.
      expectedProductName: item.title,
      expectedUnitsPerPackage: item.unitsPerPackage,
      expectedUnitSize: manuallySelected ? null : line.unitSizeValue ? `${line.unitSizeValue}${line.unitSizeUnit}` : null,
      expectedStrength: manuallySelected ? null : line.strengthValue ? `${line.strengthValue}${line.strengthUnit}` : null,
      expectedPackageContent: manuallySelected ? null : line.packageContentCount ? `${line.packageContentCount}${line.packageContentUnit}` : null,
      status: "QUEUED" as const,
    }];
  });

  const clearPreparedCartState = () => {
    cartRunId.current = null;
    setPreflight(false);
    setPreflightResults([]);
    setCartResults([]);
  };

  const excludeLine = (line: ShoppingRequestLine, index: number) => {
    clearPreparedCartState();
    setExcludedIds((current) => ({ ...current, [line.id]: true }));
    if (expanded === index) setExpanded(-1);
    setNotice(`${line.productName}을 이번 장바구니에서 뺐습니다. 언제든 다시 포함할 수 있어요.`);
  };

  const includeLine = (line: ShoppingRequestLine) => {
    clearPreparedCartState();
    setExcludedIds((current) => {
      const next = { ...current };
      delete next[line.id];
      return next;
    });
    setNotice(`${line.productName}을 다시 담기 대상에 포함했습니다.`);
  };

  const updateRequestedQuantity = (line: ShoppingRequestLine, delta: number) => {
    const nextQuantity = Math.max(1, Math.min(99, line.requestedPhysicalUnits + delta));
    if (nextQuantity === line.requestedPhysicalUnits) return;
    clearPreparedCartState();
    setLines((current) => current.map((item) => item.id === line.id
      ? { ...item, requestedPhysicalUnits: nextQuantity, requestedPurchaseUnits: nextQuantity }
      : item));
  };

  const retryCandidateSearch = async (line: ShoppingRequestLine) => {
    const query = (searchQueries[line.id] ?? line.productName).trim();
    if (!query || searchingLineId) return;
    setSearchingLineId(line.id);
    setNotice(null);
    try {
      const searchLine: ShoppingRequestLine = {
        ...line,
        rawText: query,
        normalizedText: query,
        brand: null,
        productName: query,
        variantTokens: [],
        unitSizeValue: null,
        unitSizeUnit: null,
        strengthValue: null,
        strengthUnit: null,
        packageContentCount: null,
        packageContentUnit: null,
      };
      const response = await chrome.runtime.sendMessage({ type: "DDAKDAMA_SEARCH_ALL", items: [searchLine] });
      const output = response?.output as SearchGroup[] | undefined;
      const nextGroup = output?.find((candidate) => candidate.requestLineId === line.id);
      if (!nextGroup) throw new Error("INCOMPLETE_SEARCH_RESPONSE");
      setGroups((current) => [...current.filter((candidate) => candidate.requestLineId !== line.id), nextGroup]);
      setSelectedIds((current) => {
        const next = { ...current };
        delete next[line.id];
        return next;
      });
      setNotice(nextGroup.results.length ? `${line.productName} 후보 ${nextGroup.results.length}개를 찾았습니다.` : searchErrorMessage(nextGroup.error));
    } catch {
      setNotice("이 상품의 후보를 다시 찾지 못했습니다. 잠시 후 재시도해 주세요.");
    } finally {
      setSearchingLineId(null);
    }
  };

  const refreshActiveCandidates = async () => {
    if (searching || !activeLines.length) return;
    const missing = activeLines.filter((line) => !selected[line.id]);
    const searchLines = missing.length ? missing : activeLines;
    const searchIds = new Set(searchLines.map((line) => line.id));
    setSearching(true);
    setNotice(null);
    try {
      const response = await chrome.runtime.sendMessage({ type: "DDAKDAMA_SEARCH_ALL", items: searchLines });
      if (!response?.ok || !Array.isArray(response.output)) throw new Error(response?.error ?? "SEARCH_FAILED");
      const output = response.output as SearchGroup[];
      const outputIds = new Set(output.map((group) => group.requestLineId));
      if (output.length !== searchLines.length || searchLines.some((line) => !outputIds.has(line.id))) throw new Error("INCOMPLETE_SEARCH_RESPONSE");
      setGroups((current) => [
        ...current.filter((group) => !searchIds.has(group.requestLineId)),
        ...output,
      ]);
      setSelectedIds((current) => Object.fromEntries(Object.entries(current).filter(([lineId]) => !searchIds.has(lineId))));
      const merged = [...groups.filter((group) => !searchIds.has(group.requestLineId)), ...output];
      const exact = activeLines.filter((line) => selectedIds[line.id] && !searchIds.has(line.id) || selectBestCandidate(line, merged.find((group) => group.requestLineId === line.id)?.results ?? [])).length;
      setExpanded(lines.findIndex((line) => searchIds.has(line.id) && !selectBestCandidate(line, output.find((group) => group.requestLineId === line.id)?.results ?? [])));
      const blocked = output.find((group) => group.error && group.error !== "NO_RESULTS");
      setNotice(blocked ? searchErrorMessage(blocked.error) : exact === activeLines.length
        ? `담을 상품 ${activeLines.length}종의 후보를 다시 확인했습니다.`
        : `정확한 후보 ${exact}종 · 직접 확인 필요 ${activeLines.length - exact}종입니다.`);
    } catch {
      setNotice("담을 상품 후보를 다시 찾지 못했습니다. 잠시 후 재시도해 주세요.");
    } finally {
      setSearching(false);
    }
  };

  const runPreflight = async () => {
    if (adding || activeLines.length === 0 || selectedCount !== activeLines.length) return;
    // Only this explicit UI action acknowledges the visible default choices.
    // Search/import never acknowledges alternatives and never runs cart jobs.
    const confirmedSelections = { ...selectedIds };
    for (const line of activeLines) {
      const item = selected[line.id];
      if (item && !candidateMatchesRequest(line, item)) confirmedSelections[line.id] = item.id;
    }
    setSelectedIds(confirmedSelections);
    setAdding(true);
    setPreflight(false);
    setPreflightResults(activeLines.map((line) => ({ id: line.id, status: "CHECKING" })));
    setStep(3);
    try {
      const response = await chrome.runtime.sendMessage({ type: "DDAKDAMA_PREFLIGHT", jobs: makeJobs(confirmedSelections) });
      if (response?.ok === false || !Array.isArray(response?.results)) throw new Error(response?.error ?? "PREFLIGHT_FAILED");
      const results = response.results as CartResult[];
      setPreflightResults(results);
      setPreflight(true);
      setStep(3);
      const ready = results.filter((result) => result.status === "READY").length;
      setNotice(ready === activeLines.length
        ? `담을 상품 ${activeLines.length}종의 현재 가격과 규격을 확인했습니다.`
        : `${activeLines.length - ready}개 상품은 현재 가격 또는 규격을 다시 확인해야 합니다.`);
    } catch (error) {
      setPreflight(true);
      setPreflightResults(activeLines.map((line) => ({ id: line.id, status: "PRODUCT_DETAIL_UNAVAILABLE" })));
      setNotice(error instanceof Error && error.message === "CART_AUTOMATION_DISABLED"
        ? "공개 베타에서는 자동 상세 확인을 제공하지 않습니다. 선택한 상품 페이지에서 가격·배송·옵션을 직접 확인해 주세요."
        : "상품 상세정보를 확인하지 못했습니다. 다시 시도해 주세요.");
    } finally {
      setAdding(false);
    }
  };

  const finishRun = async (results: CartResult[]) => {
    setCartResults(results);
    setRecoverable(null);
    const success = results.filter((result) => result.status === "SUCCESS").length;
    const skipped = results.filter(result=>result.skippedExisting).length;
    setStep(4);
    setNotice(results.some(result=>result.selectionWarning) ? "담기 처리는 끝났지만 체크 상태를 확인하지 못했습니다. 쿠팡에서 선택 상태를 확인해 주세요." : skipped ? `새로 처리 ${success-skipped}종 · 기존 상품 ${skipped}종은 중복 담지 않았습니다.` : success === activeLines.length
      ? `요청한 상품 ${success}종을 모두 검증해 담았습니다.`
      : `성공 ${success}종 · 실패 ${activeLines.length - success}종입니다. 실패 상품을 확인해 주세요.`);
  };

  const appendShoppingList = async () => {
    const raw = appendInput.trim();
    if (!raw) {
      setNotice("추가할 상품을 한 줄에 하나씩 입력해 주세요.");
      return;
    }

    const addedLines = parseShoppingList(raw).map((line, index) => ({
      ...line,
      // Existing request ids must remain stable because candidates and cart results use them.
      id: `line-${lines.length + index + 1}`,
    }));
    if (!addedLines.length) {
      setNotice("추가할 상품을 인식하지 못했습니다. 상품명과 수량을 다시 확인해 주세요.");
      return;
    }

    clearPreparedCartState();
    setLines((current) => [...current, ...addedLines]);
    setInput((current) => [current.trim(), raw].filter(Boolean).join("\n"));
    setAppendInput("");
    setStep(2);
    setExpanded(lines.length);
    setSearching(true);
    setNotice(null);
    try {
      const response = await chrome.runtime.sendMessage({ type: "DDAKDAMA_SEARCH_ALL", items: addedLines });
      if (!response?.ok || !Array.isArray(response.output)) throw new Error(response?.error ?? "SEARCH_FAILED");
      const output = response.output as SearchGroup[];
      const outputIds = new Set(output.map((group) => group.requestLineId));
      if (output.length !== addedLines.length || addedLines.some((line) => !outputIds.has(line.id))) {
        throw new Error("INCOMPLETE_SEARCH_RESPONSE");
      }
      setGroups((current) => [...current, ...output]);
      const exact = addedLines.filter((line) => selectBestCandidate(line, output.find((group) => group.requestLineId === line.id)?.results ?? [])).length;
      setNotice(exact === addedLines.length
        ? `${addedLines.length}개 상품을 기존 목록에 추가하고 후보를 찾았습니다.`
        : `${addedLines.length}개 상품을 추가했습니다. ${addedLines.length - exact}개는 후보를 직접 확인해 주세요.`);
    } catch {
      // Keep the newly appended request visible even when Coupang search is temporarily unavailable.
      setGroups((current) => [...current, ...addedLines.map((line) => ({ requestLineId: line.id, results: [], error: "SEARCH_FAILED" }))]);
      setNotice("상품은 목록에 추가됐지만 후보 검색을 완료하지 못했습니다. 해당 상품에서 다시 검색해 주세요.");
    } finally {
      setSearching(false);
    }
  };

  const executeJobs = async (jobs: CartJob[], seed: CartResult[] = []) => {
    if (adding || !jobs.length) return;
    setAdding(true);
    try {
      cartRunId.current ??= crypto.randomUUID();
      const response = await chrome.runtime.sendMessage({
        type: "DDAKDAMA_RUN_CART_JOBS",
        runId: cartRunId.current,
        jobs,
      });
      const completed = (response?.results ?? []) as CartResult[];
      const combined = activeLines.map((line) =>
        completed.find((result) => result.id === line.id)
        ?? seed.find((result) => result.id === line.id)
        ?? { id: line.id, status: "UNKNOWN_ERROR" });
      await finishRun(combined);
    } catch {
      setNotice("장바구니 작업을 완료하지 못했습니다. 쿠팡 로그인과 열린 상품 페이지를 확인해 주세요.");
    } finally {
      setAdding(false);
    }
  };

  const executeReady = async (partial: boolean) => {
    const readyIds = new Set(preflightResults.filter((result) => result.status === "READY").map((result) => result.id));
    const readyJobs = makeJobs().filter((job) => readyIds.has(job.id));
    if (!partial && readyJobs.length !== activeLines.length) return;
    await executeJobs(readyJobs, preflightResults.filter((result) => result.status !== "READY"));
  };

  const resumeJournal = async () => {
    if (!recoverable || adding) return;
    setAdding(true);
    try {
      cartRunId.current = recoverable.runId;
      const response = await chrome.runtime.sendMessage({ type: "DDAKDAMA_RESUME_CART_JOURNAL" });
      if (!response?.ok) throw new Error("RESUME_FAILED");
      await finishRun(response.results ?? []);
    } catch {
      setNotice("중단된 작업을 이어가지 못했습니다. 현재 장바구니를 확인해 주세요.");
    } finally {
      setAdding(false);
    }
  };

  const clearJournal = async () => {
    await chrome.runtime.sendMessage({ type: "DDAKDAMA_CLEAR_CART_JOURNAL" });
    setRecoverable(null);
    setNotice("중단된 작업 기록을 정리했습니다. 실제 장바구니 상품은 변경하지 않았습니다.");
  };

  const startPairing = async () => {
    setPairingBusy(true);
    try {
      const stored = await chrome.storage.local.get(["ddakdama-device-token"]);
      const previousToken = String(stored["ddakdama-device-token"] ?? "");
      if (previousToken) {
        await fetch(`${SERVER_ORIGIN}/api/device/revoke`, {
          method: "POST",
          headers: { authorization: `Bearer ${previousToken}` },
        }).catch(() => undefined);
      }
      await chrome.storage.local.remove(["ddakdama-device-id", "ddakdama-device-token", "ddakdama-pairing-code", "ddakdama-pairing-expires-at"]);
      setPairingCode(null);
      setPairingExpiresAt(null);
      const response = await fetch(`${SERVER_ORIGIN}/api/pairing/start`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{}",
      });
      if (!response.ok) throw new Error("PAIRING_START_FAILED");
      const data = await response.json() as { code: string; deviceId: string; deviceToken: string; expiresAt?: number };
      if (!/^\d{6}$/.test(data.code) || !data.deviceId || !data.deviceToken) throw new Error("INVALID_PAIRING_RESPONSE");
      const expiresAt = data.expiresAt ?? Date.now() + 10 * 60_000;
      await chrome.storage.local.set({
        "ddakdama-device-id": data.deviceId,
        "ddakdama-device-token": data.deviceToken,
        "ddakdama-pairing-code": data.code,
        "ddakdama-pairing-expires-at": expiresAt,
      });
      setPairingCode(data.code);
      setPairingExpiresAt(expiresAt);
      setPairingState("code");
      setNotice("ChatGPT 딱담아 앱에 이 6자리 코드를 입력해 주세요.");
    } catch {
      setPairingState("unavailable");
      setNotice("연결 코드를 만들지 못했습니다. 인터넷 연결을 확인한 뒤 새 코드를 다시 만들어 주세요.");
    } finally {
      setPairingBusy(false);
    }
  };

  const importFromGpt = async (automatic = false) => {
    if (incomingGptBusy.current) return;
    incomingGptBusy.current = true;
    if (!automatic) setPairingBusy(true);
    try {
      const stored = await chrome.storage.local.get([
        "ddakdama-device-token",
        "ddakdama-pairing-code",
        "ddakdama-pairing-expires-at",
      ]);
      const token = String(stored["ddakdama-device-token"] ?? "");
      if (!token) {
        if (!automatic) setNotice("먼저 연결 코드를 만들어 ChatGPT 앱에 입력해 주세요.");
        return;
      }
      const status = await fetchPairingStatus(token);
      if (!status.connected) {
        const code = String(stored["ddakdama-pairing-code"] ?? "");
        const expiresAt = Number(stored["ddakdama-pairing-expires-at"] ?? 0);
        if (/^\d{6}$/.test(code) && expiresAt > Date.now()) {
          setPairingCode(code);
          setPairingExpiresAt(expiresAt);
          setPairingState("code");
        }
        if (!automatic) setNotice("아직 연결되지 않았습니다. ChatGPT 딱담아 앱에 표시된 코드를 입력하고 ‘연결’을 완료해 주세요.");
        return;
      }
      setPairingState("connected");
      setPairingCode(null);
      setPairingExpiresAt(null);
      await chrome.storage.local.remove(["ddakdama-pairing-code", "ddakdama-pairing-expires-at"]);
      const response = await fetch(`${SERVER_ORIGIN}/api/handoffs/latest`, {
        headers: { authorization: `Bearer ${token}` },
      });
      if (!response.ok) throw new Error("HANDOFF_FETCH_FAILED");
      const data = await response.json() as {
        handoff: null | {
          id: string;
          payload: {
            items?: Array<{ rawText?: string }>;
            cartPlan?: { id?: string; version?: number; accessToken?: string };
          };
        };
      };
      if (!data.handoff) {
        if (!automatic) setNotice("연결됐습니다. ChatGPT 딱담아 앱에서 목록을 보내면 빈 확장 화면에서 자동으로 받습니다.");
        return;
      }
      const raw = (data.handoff.payload.items ?? []).map((item) => item.rawText?.trim()).filter(Boolean).join("\n");
      if (!raw) throw new Error("EMPTY_HANDOFF");
      setInput(raw);
      const handoffPlan = data.handoff.payload.cartPlan;
      let hydratedPlan = false;
      if (handoffPlan?.id && handoffPlan.accessToken) {
        const planResponse = await fetch(`${SERVER_ORIGIN}/api/plans/${encodeURIComponent(handoffPlan.id)}`, {
          headers: { authorization: `Bearer ${handoffPlan.accessToken}` },
        });
        if (planResponse.ok) {
          const planData = await planResponse.json() as { plan?: PersistedPlan };
          const persisted = planData.plan;
          const planLines = persisted?.items.map((item) => restorePlanRequest(item.request)) ?? [];
          if (persisted && planLines.length === persisted.items.length && planLines.length > 0) {
            setInput(planLines.map((line) => line.rawText).join("\n"));
            resetAfterInput(planLines);
            setGroups(persisted.items.map((item, index) => ({
              requestLineId: planLines[index]!.id,
              results: item.candidates.map(asExtensionCandidate),
            })));
            setSelectedIds(Object.fromEntries(persisted.items.flatMap((item, index) => {
              const selected = item.candidates.find((candidate) => candidate.id === item.selectedCandidateId);
              return selected ? [[planLines[index]!.id, selected.id]] : [];
            })));
            setStep(persisted.items.every((item) => item.selectedCandidateId) ? 2 : 1);
            hydratedPlan = true;
          }
        }
      }
      if (!hydratedPlan) resetAfterInput(parseShoppingList(raw));
      const ackResponse = await fetch(`${SERVER_ORIGIN}/api/handoffs/${encodeURIComponent(data.handoff.id)}/ack`, {
        method: "POST",
        headers: { authorization: `Bearer ${token}` },
      });
      const ackData = await ackResponse.json().catch(() => ({ ok: false })) as { ok?: boolean };
      if (!ackResponse.ok || ackData.ok !== true) {
        setPairingState("connected");
        setNotice("목록은 불러왔지만 수신 확인이 완료되지 않았습니다. ‘목록 받기’를 다시 눌러 주세요.");
        return;
      }
      setPairingState("connected");
      await chrome.storage.local.remove(["ddakdama-pairing-code", "ddakdama-pairing-expires-at"]);
      setNotice(hydratedPlan
        ? `ChatGPT에서 확정한 계획(v${handoffPlan?.version ?? "?"})과 상품 선택을 불러왔습니다.`
        : "ChatGPT 앱에서 보낸 쇼핑 목록을 불러왔습니다.");
      // Receiving a list is never permission to send shopping-site searches.
      // The user starts those with the explicit '실제 상품 찾기' action.
    } catch (error) {
      if (error instanceof Error && error.message === "PAIRING_UNAUTHORIZED") {
        await chrome.storage.local.remove([...pairingStorageKeys]);
        setPairingCode(null);
        setPairingExpiresAt(null);
        setPairingState("idle");
        setNotice("연결 정보가 만료됐습니다. 새 6자리 코드를 만들어 다시 연결해 주세요.");
      } else {
        setPairingState("unavailable");
        setNotice("GPT 앱 연결 상태를 확인하지 못했습니다. 잠시 후 ‘목록 받기’를 다시 눌러 주세요.");
      }
    } finally {
      incomingGptBusy.current = false;
      if (!automatic) setPairingBusy(false);
    }
  };

  useEffect(() => {
    if (!restored || preview || !["code", "connected"].includes(pairingState)
      || step !== 1 || lines.length || input.trim() || adding || searching || planLinkBusy) return;
    // A paired, empty, visible panel receives a new app plan without copy/paste.
    // Stop polling as soon as a list is loaded or any user work is in progress.
    const receive = () => { if (document.visibilityState === "visible") void importFromGpt(true); };
    receive();
    const timer = window.setInterval(receive, 5000);
    return () => window.clearInterval(timer);
  }, [restored, pairingState, step, lines.length, input, adding, searching, planLinkBusy, preview]);

  const disconnectGpt = async () => {
    setPairingBusy(true);
    try {
      const stored = await chrome.storage.local.get(["ddakdama-device-token"]);
      const token = String(stored["ddakdama-device-token"] ?? "");
      if (token) {
        await fetch(`${SERVER_ORIGIN}/api/device/revoke`, {
          method: "POST",
          headers: { authorization: `Bearer ${token}` },
        });
      }
    } finally {
      await chrome.storage.local.remove(["ddakdama-device-id", "ddakdama-device-token", "ddakdama-pairing-code", "ddakdama-pairing-expires-at"]);
      setPairingCode(null);
      setPairingExpiresAt(null);
      setPairingState("idle");
      setPairingBusy(false);
      setNotice("연결을 해제했습니다. 다시 연결하려면 새 6자리 코드를 만들어 주세요.");
    }
  };

  const openCart = async () => {
    try {
      if (chrome?.runtime?.sendMessage) {
        const response = await chrome.runtime.sendMessage({ type: "DDAKDAMA_OPEN_CART" });
        if (response?.ok === false) throw new Error(String(response.error ?? "OPEN_CART_FAILED"));
        return;
      }
      window.open("https://cart.coupang.com/cartView.pang", "_blank", "noopener,noreferrer");
    } catch {
      setNotice("쿠팡 장바구니를 열지 못했습니다. 상단 장바구니 버튼으로 다시 시도해 주세요.");
    }
  };
  const startNewList = async () => {
    setInput("");
    resetAfterInput([]);
    setRecoverable(null);
    setNotice(null);
    if (chrome?.runtime?.sendMessage) {
      await chrome.runtime.sendMessage({ type: "DDAKDAMA_CLEAR_CART_JOURNAL" }).catch(() => undefined);
    }
  };
  const openAppendList = () => {
    clearPreparedCartState();
    setStep(1);
    setNotice("기존 목록은 유지됩니다. 아래에 추가할 상품만 입력해 주세요.");
  };
  const openChatGPTApp = () => {
    window.open(CHATGPT_APP_URL, "_blank", "noopener,noreferrer");
    setNotice("딱담아 GPTs를 새 탭에서 열었습니다. GPTs는 대화로 목록을 만들고, 이 확장프로그램은 PC에서 같은 계획을 이어서 확인합니다.");
  };
  const openProduct = (lineId: string) => {
    const url = selected[lineId]?.productUrl;
    if (url && chrome?.tabs?.create) void chrome.tabs.create({ url });
  };
  const openCoupangSearch = async (line: ShoppingRequestLine) => {
    if (!chrome?.runtime?.sendMessage) return;
    try {
      const response = await chrome.runtime.sendMessage({ type: "DDAKDAMA_OPEN_SEARCH", query: searchQueries[line.id] ?? line.rawText });
      setNotice(response?.ok ? "쿠팡 검색창에서 검색했습니다. 결과를 확인한 뒤 이 화면에서 다시 찾기를 누르면 열린 결과를 가져옵니다." : searchErrorMessage(response?.error));
    } catch { setNotice("쿠팡 검색창을 열지 못했습니다. 확장프로그램 연결을 확인해 주세요."); }
  };
  const openResultProduct = (result: CartResult) => {
    const url = result.productUrl ?? selected[result.id]?.productUrl;
    if (url && chrome?.tabs?.create) void chrome.tabs.create({ url });
  };

  const retryLine = async (lineId: string) => {
    const job = makeJobs().find((candidate) => candidate.id === lineId);
    if (!job || adding) return;
    setAdding(true);
    try {
      const response = await chrome.runtime.sendMessage({
        type: "DDAKDAMA_RUN_CART_JOBS",
        runId: cartRunId.current ??= crypto.randomUUID(),
        jobs: [job],
      });
      if (!response?.ok) throw new Error(response?.error ?? "RETRY_FAILED");
      const result = response?.results?.[0] as CartResult | undefined;
      if (!result) throw new Error("EMPTY_RESULT");
      setCartResults((current) => [...current.filter((item) => item.id !== lineId), result]);
      setNotice(result.status === "SUCCESS" ? "해당 상품을 정확한 수량으로 담았습니다." : statusMessage(result.status, result.mismatchReasons));
    } catch (error) {
      setNotice(error instanceof Error && error.message === "CART_AUTOMATION_DISABLED"
        ? "공개 베타에서는 자동 장바구니 담기를 제공하지 않습니다. 상품 페이지에서 직접 담아 주세요."
        : "재시도하지 못했습니다. 상품 페이지에서 상태를 확인해 주세요.");
    } finally {
      setAdding(false);
    }
  };

  const retryFailed = async () => {
    const failedIds = new Set(cartResults.filter((result) => result.status !== "SUCCESS").map((result) => result.id));
    const jobs = makeJobs().filter((job) => failedIds.has(job.id));
    if (!jobs.length || adding) return;
    await executeJobs(jobs, cartResults.filter((result) => result.status === "SUCCESS"));
  };

  const goBack = () => {
    if (step === 4) setStep(3);
    else if (step === 3) { setStep(2); setPreflight(false); setPreflightResults([]); }
    else if (step === 2) setStep(1);
  };

  const renderGptConnection = () => (
    <>
    <section className={`gpt-bridge ${pairingState}`} aria-label="ChatGPT 목록 연결">
      <span className="gpt-bridge-icon"><Link2 size={19} /></span>
      <div className="gpt-bridge-copy" aria-live="polite">
        <strong>ChatGPT에서 목록 받기</strong>
        {pairingState === "code" && pairingCode ? (
          <small>처음 한 번만 ChatGPT 딱담아 앱에 아래 코드를 입력하세요. 연결 뒤에는 목록을 자동으로 받습니다.</small>
        ) : pairingState === "connected" ? (
          <small><CheckCircle2 size={13} /> 연결됨 · 보낸 목록을 바로 받을 수 있어요</small>
        ) : pairingState === "unavailable" ? (
          <small>코드를 만들지 못했어요. 새 코드를 다시 만들어 주세요.</small>
        ) : (
          <small>처음 한 번만 코드로 연결하면 ChatGPT 딱담아 앱의 목록을 자동으로 받습니다. 계획 링크는 필요 없습니다.</small>
        )}
      </div>
      {pairingState === "code" && pairingCode ? (
        <div className="gpt-code-row">
          <output className="pairing-code" aria-label={`연결 코드 ${pairingCode}`}>{pairingCode.slice(0, 3)} {pairingCode.slice(3)}</output>
          <button type="button" className="receive" onClick={() => void importFromGpt()} disabled={pairingBusy}>
            {pairingBusy ? <LoaderCircle className="spin" size={15} /> : null}목록 받기
          </button>
          <button type="button" className="secondary-action" onClick={startPairing} disabled={pairingBusy}>새 코드</button>
        </div>
      ) : (
        <div className="gpt-bridge-actions">
          {pairingState === "idle" || pairingState === "unavailable" ? (
            <button type="button" onClick={startPairing} disabled={pairingBusy}>
              {pairingBusy ? "코드 만드는 중…" : pairingState === "unavailable" ? "새 코드 다시 만들기" : "6자리 코드 만들기"}
            </button>
          ) : (
            <button type="button" className="receive" onClick={() => void importFromGpt()} disabled={pairingBusy}>
              {pairingBusy ? <LoaderCircle className="spin" size={15} /> : null}목록 받기
            </button>
          )}
          {pairingState === "connected" && (
            <button type="button" className="disconnect-action" onClick={disconnectGpt} disabled={pairingBusy}><Unlink size={15} /> 연결 해제</button>
          )}
        </div>
      )}
    </section>
    </>
  );

  const renderPlanBridge = () => (
    <>
      {renderGptConnection()}
      <section className="plan-link-import primary-plan-bridge" aria-label="딱담아 계획 바로 이어하기">
        <strong>웹·GPTs 링크로 불러오기 (선택)</strong>
        <small>코드로 연결했다면 링크는 필요 없습니다. 공유할 때만 입력 목록의 링크를 만드세요. 상품 선택·담기 승인은 포함되지 않습니다.</small>
        <button type="button" disabled={shareBusy || !input.trim()} onClick={async () => {
          setShareBusy(true); setShareLink("");
          try {
            const response = await fetch(`${PUBLIC_WEB_ORIGIN}/api/gpt/plans`, {method:"POST", headers:{"content-type":"application/json"}, body:JSON.stringify({shoppingList:input, consentToStoreRaw:false})});
            if (!response.ok) throw new Error("SHARE_FAILED");
            const data = await response.json() as {planUrl?:string};
            if (!isTrustedPlanLink(data.planUrl)) throw new Error("INVALID_LINK");
            setShareLink(data.planUrl);
          } catch { setNotice("목록 링크를 만들지 못했습니다. 입력 목록은 그대로 유지됩니다."); }
          finally { setShareBusy(false); }
        }}>{shareBusy ? "링크 만드는 중…" : "입력 목록 공유 링크 만들기"}</button>
        {shareLink && <label>공유 링크 (링크를 가진 사람이 목록을 볼 수 있습니다)<input aria-label="생성된 공유 링크" readOnly value={shareLink} onFocus={event => event.target.select()} /></label>}
        <small>GPT 또는 딱담아 웹에서 Chrome 확장프로그램으로 계속하기를 누르면 같은 계획이 자동으로 열립니다.</small>
        <div>
          <input
            value={planLinkInput}
            onChange={(event) => setPlanLinkInput(event.target.value)}
            placeholder="계획 링크 붙여넣기 (자동으로 열리지 않을 때만)"
            inputMode="url"
            aria-label="딱담아 계획 링크"
          />
          <button type="button" onClick={() => void importPlanLink()} disabled={!planLinkInput.trim() || planLinkBusy}>
            {planLinkBusy ? "불러오는 중" : "불러오기"}
          </button>
        </div>
      </section>
      <button className="gpt-app-shortcut" type="button" onClick={openChatGPTApp}>
        <Link2 size={16} />
        딱담아 GPTs에서 목록 만들기
        <ChevronRight size={16} aria-hidden="true" />
      </button>
    </>
  );

  const renderSelection = () => (
    <>
      <section className="screen-heading">
        <div><h1>상품을 확인해 주세요</h1><p>잘 맞는 후보를 기본 선택했어요. 상품을 눌러 다른 후보로 바꿀 수 있어요.</p></div>
        <div className="selection-statuses">
          <span className={activeLines.length > 0 && selectedCount === activeLines.length ? "status success" : "status warning"}>
            {activeLines.length > 0 && selectedCount === activeLines.length ? <Check size={15} /> : <CircleHelp size={15} />}
            {selectedCount}/{activeLines.length}종 선택
          </span>
          {excludedCount > 0 && <span className="status excluded">제외 {excludedCount}종</span>}
        </div>
      </section>
      {defaultReviewCount > 0 && <section className="manual-warning" aria-label="기본 선택 안내">
        <AlertCircle size={18} />
        <div><strong>기본 후보 {defaultReviewCount}종을 확인해 주세요</strong><span>요청과 정확히 일치하지 않아 첫 번째 후보를 선택했어요. 아래 상품명·규격·묶음 수량을 보고 ‘선택한 상품 확인하기’를 누르면 이 선택으로 상세 검증합니다. 아직 장바구니에는 담지 않습니다.</span></div>
      </section>}
      <section className="product-group" aria-label="선택된 상품">
        {lines.map((line, index) => {
          const item = selected[line.id];
          const manuallySelected = Boolean(item && selectedIds[line.id] === item.id);
          const defaultNeedsReview = Boolean(item && !manuallySelected && !candidateMatchesRequest(line, item));
          const purchaseQty = item ? purchaseQuantity(line, item, manuallySelected) : 0;
          const selectionWarnings = item && (manuallySelected || defaultNeedsReview) ? manualSelectionWarnings(line, item) : [];
          const group = groups.find((candidate) => candidate.requestLineId === line.id);
          const results = group?.results ?? [];
          const resultState = candidateState(line, results);
          const excluded = Boolean(excludedIds[line.id]);
          if (excluded) {
            return (
              <article className="product-row excluded-product" data-testid={`product-${index}`} key={line.id}>
                <div className="excluded-product-row">
                  <span className="excluded-product-icon"><MinusCircle size={18} /></span>
                  <div><strong>{line.productName}</strong><small>이번 장바구니에서 제외했어요.</small></div>
                  <button type="button" onClick={() => includeLine(line)}>다시 포함</button>
                </div>
              </article>
            );
          }
          return (
            <article className={`product-row ${expanded === index ? "expanded" : ""} ${item ? "" : "needs-attention"} ${manuallySelected ? "manual-selection" : ""}`} data-testid={`product-${index}`} key={line.id}>
              <div className="product-row-top">
                <button className="product-row-main" type="button" onClick={() => setExpanded(expanded === index ? -1 : index)} aria-expanded={expanded === index}>
                <span className={item ? "selection-check" : "selection-check empty"}>{item ? <Check size={14} /> : index + 1}</span>
                <ProductImage item={item} />
                <span className="product-row-copy">
                  <strong>{item?.title ?? line.productName}</strong>
                  {manuallySelected && <em>직접 선택</em>}
                  {defaultNeedsReview && <em>기본 선택 · 확인 필요</em>}
                  <small>{stateLabel(line)}{item?.unitsPerPackage && item.unitsPerPackage > 1 ? ` · ${item.unitsPerPackage}개 묶음 × ${purchaseQty}` : ""}</small>
                  {defaultNeedsReview && <small>요청: {line.productName}{selectionWarnings.length ? ` · ${selectionWarnings.join(" / ")}` : ""}</small>}
                </span>
                <span className="product-row-price">{item?.currentPrice ? <><b>{(item.currentPrice * purchaseQty).toLocaleString()}원</b>{purchaseQty > 1 && <small>{item.currentPrice.toLocaleString()}원 × {purchaseQty}</small>}</> : item ? "상세에서 가격 확인" : group?.error ? searchErrorLabel(group.error) : results.length ? `후보 ${results.length}개 보기` : "검색 결과 없음"}</span>
                {!item && !group?.error && <span className="product-row-state">{resultState}</span>}
                <ChevronDown className="row-chevron" size={18} />
                </button>
                <button className="line-exclude-button" type="button" onClick={() => excludeLine(line, index)} aria-label={`${line.productName} 이 품목 빼기`}><MinusCircle size={17} /><span>빼기</span></button>
              </div>
              {expanded === index && (
                <div className="candidate-panel">
                  <div className="selection-tools">
                    <span>담을 실물 수량</span>
                    <div className="quantity-stepper" role="group" aria-label={`${line.productName} 담을 실물 수량`}>
                      <button type="button" onClick={() => updateRequestedQuantity(line, -1)} disabled={line.requestedPhysicalUnits <= 1} aria-label={`${line.productName} 수량 1개 줄이기`}><Minus size={14} /></button>
                      <output>{line.requestedPhysicalUnits}</output>
                      <button type="button" onClick={() => updateRequestedQuantity(line, 1)} disabled={line.requestedPhysicalUnits >= 99} aria-label={`${line.productName} 수량 1개 늘리기`}><Plus size={14} /></button>
                    </div>
                  </div>
                  <p className={item && !selectionWarnings.length ? "match-copy" : "match-copy warning"}>
                    {manuallySelected ? "선택을 확인한 상품입니다. 다음 단계에서 가격·재고·옵션을 다시 확인해요." : defaultNeedsReview ? "첫 번째 후보를 기본 선택했어요. 요청과 다른 점을 확인하고 필요하면 다른 상품으로 바꿔 주세요." : item ? (item.currentPrice ? "규격과 수량이 가장 잘 맞는 상품이에요." : "상품은 일치하며 현재 가격은 상세페이지에서 확인해요.") : group?.error ? searchErrorMessage(group.error) : "선택할 수 있는 상품이 없어요. 검색어를 수정해 다시 찾아 주세요."}
                  </p>
                  <div className="candidate-actions">
                    {results.length > 0 && <button type="button" onClick={() => setExpanded(index)}>후보 {results.length}개 보기</button>}
                    <button type="button" onClick={() => openCoupangSearch(line)}>직접 쿠팡에서 검색</button>
                  </div>
                  {selectionWarnings.length > 0 && (
                    <div className="manual-warning" role="alert">
                      <AlertCircle size={16} />
                      <div><strong>요청과 다른 점이 있어요</strong>{selectionWarnings.map((warning) => <span key={warning}>{warning}</span>)}</div>
                    </div>
                  )}
                  <div className="candidate-list" aria-label={`${line.productName} 상품 후보`}>
                    {results.map((candidate) => {
                      const exact = candidateMatchesRequest(line, candidate);
                      const active = item?.id === candidate.id;
                      const candidatePurchaseQuantity = purchaseQuantity(line, candidate, !exact);
                      const candidateWarnings = exact ? [] : manualSelectionWarnings(line, candidate);
                      return (
                        <button
                          type="button"
                          className={`candidate-row ${active ? "active" : ""}`}
                          key={candidate.id}
                          onClick={() => {
                            cartRunId.current = null;
                            setPreflight(false);
                            setPreflightResults([]);
                            setCartResults([]);
                            setSelectedIds((current) => ({ ...current, [line.id]: candidate.id }));
                          }}
                          aria-pressed={active}
                        >
                          <span className="candidate-radio">{active ? <Check size={12} /> : null}</span>
                          <span><strong>{candidate.title}</strong><small>{candidate.currentPrice ? priceBreakdown(candidate.currentPrice, line, candidate, !exact) : "상세에서 가격 확인"} · {candidate.unitsPerPackage === 1 ? `단품 × ${candidatePurchaseQuantity}` : `${candidate.unitsPerPackage}개 묶음 × ${candidatePurchaseQuantity}`}{candidate.fulfillmentType === "ROCKET_FRESH" ? " · 로켓프레시" : candidate.rocketDelivery ? " · 로켓배송" : candidate.fulfillmentType === "SELLER_DELIVERY" ? " · 판매자 배송" : " · 배송 방식 확인 필요"}{candidate.shippingFee === null || candidate.shippingFee === undefined ? " · 배송비 확인 필요" : candidate.shippingFee === 0 ? " · 무료배송 확인" : ` · 배송비 ${candidate.shippingFee.toLocaleString()}원`}{candidate.deliveryPromise ? ` · ${candidate.deliveryPromise}` : ""}{candidateWarnings.length ? " · 요청과 다름" : ""}</small></span>
                          <b>{active ? (manuallySelected ? "직접 선택" : defaultNeedsReview ? "기본 선택" : "선택됨") : exact ? "선택" : "직접 선택"}</b>
                        </button>
                      );
                    })}
                    {!results.length && (
                      <div className="empty-candidates">
                        <p>{group?.error ? searchErrorMessage(group.error) : "검색된 후보가 없습니다."}</p>
                        <label htmlFor={`retry-query-${line.id}`}>검색어 수정</label>
                        <div className="retry-search-row">
                          <input id={`retry-query-${line.id}`} value={searchQueries[line.id] ?? line.productName} onChange={(event) => setSearchQueries((current) => ({ ...current, [line.id]: event.target.value }))} />
                          <button type="button" onClick={() => void retryCandidateSearch(line)} disabled={searchingLineId === line.id || !(searchQueries[line.id] ?? line.productName).trim()}>
                            {searchingLineId === line.id ? <LoaderCircle className="spin" size={15} /> : <Search size={15} />}다시 검색
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </article>
          );
        })}
      </section>
    </>
  );

  const renderReview = () => {
    const checking = adding && !preflight;
    const allReady = preflightReadyCount === activeLines.length && activeLines.length > 0;
    const issues = preflightResults.filter((result) => activeLineIds.has(result.id) && result.status !== "READY");
    return (
      <>
        <section className="screen-heading review-heading">
          <div><h1>담기 전 확인</h1><p>{checking ? "상품 페이지에서 가격·규격·구매 조건을 확인하고 있어요." : "상품 페이지의 가격·규격·구매 조건 확인 결과입니다."}</p></div>
          <button className="secondary-action edit-selection" type="button" onClick={goBack} disabled={adding}>후보·수량 다시 고르기</button>
        </section>
        <section className={checking ? "review-summary" : allReady ? "review-summary success" : "review-summary error"} aria-live="polite">
          {checking ? <LoaderCircle className="spin" size={22} /> : allReady ? <CheckCircle2 size={22} /> : <AlertCircle size={22} />}
          <div>
            <strong>{checking ? `${activeLines.length}종을 확인하고 있어요` : allReady ? `${activeLines.length}개 상품을 모두 확인했어요` : `${preflightIssueCount}개 상품을 다시 확인해야 해요`}</strong>
            <p>{checking ? "아직 장바구니를 변경하지 않습니다. 구매할 수 없는 조건은 바로 안내합니다." : allReady ? "아래 버튼을 누를 때만 쿠팡 장바구니가 변경됩니다." : "문제가 있는 상품은 자동으로 담지 않았고 장바구니도 변경되지 않았습니다."}</p>
          </div>
        </section>
        <section className="verification-group" aria-label="상세 검증 결과">
          {activeLines.map((line) => {
            const result = preflightResults.find((candidate) => candidate.id === line.id);
            const ready = result?.status === "READY";
            const item = selected[line.id];
            return (
              <div className="verification-row" key={line.id}>
                <span className={ready ? "verification-dot ready" : "verification-dot"} />
                <span>
                  <strong>{displayProductTitle(line, result, item)}</strong>
                  <small>요청: {line.productName} · {ready && result?.verifiedPrice && item ? `${priceBreakdown(result.verifiedPrice, line, item, selectedIds[line.id] === item.id)} · 상세 확인 완료` : ready ? "상세 확인 완료" : statusMessage(result?.status, result?.mismatchReasons)}</small>
                </span>
                {!ready && !checking && <button type="button" onClick={() => openProduct(line.id)}>상품 페이지</button>}
              </div>
            );
          })}
        </section>
        {!allReady && !checking && (
          <div className="review-actions">
            <button type="button" className="secondary-action" onClick={() => openProduct(issues[0]?.id ?? "")}>문제 상품 확인</button>
            <button type="button" className="secondary-action" onClick={runPreflight} disabled={adding}>다시 확인</button>
          </div>
        )}
      </>
    );
  };

  const renderComplete = () => {
    const success = cartResults.filter((result) => result.status === "SUCCESS").length;
    const existing = cartResults.filter(result=>result.skippedExisting).length;
    const allSuccess = success === activeLines.length && activeLines.length > 0;
    return (
      <>
        <section className={`complete-hero ${allSuccess ? "success" : "partial"}`}>
          {allSuccess ? <CheckCircle2 size={30} /> : <AlertCircle size={30} />}
          <h1>{allSuccess ? existing ? "중복 없이 처리했어요" : "정확하게 모두 담았어요" : "일부 상품을 담지 못했어요"}</h1>
          <p>담기 대상 {activeLines.length}종 · 새로 담기 {success-existing}종 · 기존 유지 {existing}종 · 실패 {activeLines.length - success}종{excludedCount ? ` · 제외 ${excludedCount}종` : ""}</p>
          {cartResults.some(result=>result.selectionWarning)&&<p role="alert">쿠팡 체크 상태는 확인하지 못했습니다. 장바구니에서 직접 확인해 주세요.</p>}
        </section>
        <section className="complete-price-summary" aria-label="담은 상품 가격 합계">
          <div><small>담은 상품 확인가</small><strong>{completedVerifiedTotal.toLocaleString()}원</strong></div>
          <div><small>장바구니에서 확인</small><strong>{completedCartTotalKnown ? `${completedCartTotal.toLocaleString()}원` : "확인 불가"}</strong></div>
          <p>{completedCartTotalKnown
            ? completedCartTotal === completedVerifiedTotal
              ? "상세페이지에서 확인한 금액과 장바구니 금액이 같아요."
              : `장바구니 금액이 확인가와 ${(completedCartTotal - completedVerifiedTotal).toLocaleString()}원 달라요.`
            : "쿠팡 장바구니의 실제 줄별 금액을 아직 확인하지 못했습니다. 아래 금액은 담기 직전 상세페이지에서 확인한 상품 합계입니다."}</p>
        </section>
        <section className="result-group" aria-label="장바구니 처리 결과">
          {cartResults.map((result) => {
            const line = lines.find((item) => item.id === result.id);
            const ok = result.status === "SUCCESS";
            return (
              <div className={`result-row ${ok ? "success" : "failure"}`} key={result.id}>
                <span>{ok ? <Check size={14} /> : <AlertCircle size={15} />}</span>
                <div>
                  <strong>{displayProductTitle(line, result, line ? selected[line.id] : null)}</strong>
                  {line && <small className="requested-product-label">요청: {line.productName}</small>}
                  <small>{resultMessage(result, line, line ? selected[line.id] : null, Boolean(line && selectedIds[line.id]))}</small>
                </div>
                {!ok && <div className="result-row-actions"><button type="button" onClick={() => openResultProduct(result)}>상품 페이지</button><button type="button" disabled={adding || !line} onClick={() => retryLine(result.id)}>다시 시도</button></div>}
              </div>
            );
          })}
        </section>
      </>
    );
  };

  const actionBar = () => {
    if (step === 1) {
      const sourceLineCount = input.split(/\r?\n/).filter((value) => value.trim()).length;
      if (!lines.length) return input.trim()
        ? { label: "목록 인식하기", onClick: parseOnly, disabled: false, icon: <CheckCircle2 size={18} />, amountLabel: "입력한 목록", amount: `${sourceLineCount}줄` }
        : { label: "목록을 입력해 주세요", onClick: parseOnly, disabled: true, icon: <Search size={18} />, amountLabel: "쇼핑 목록", amount: "비어 있음" };
      return CART_AUTOMATION_ENABLED
        ? { label: "실제 상품 찾기", onClick: searchAll, disabled: searching, icon: <Search size={18} />, amountLabel: "인식 결과", amount: `${lines.length}종 · ${physicalUnits(lines)}개` }
        : { label: "쿠팡에서 직접 상품 확인", onClick: openManualReview, disabled: false, icon: <Search size={18} />, amountLabel: "인식 결과", amount: `${lines.length}종 · ${physicalUnits(lines)}개` };
    }
    if (step === 2) {
      if (!activeLines.length) return { label: "담을 상품을 1개 이상 선택해 주세요", onClick: () => undefined, disabled: true, icon: <CircleHelp size={18} />, amountLabel: "담기 대상", amount: "0종" };
      if (selectedCount !== activeLines.length) return { label: `${activeLines.length - selectedCount}종 다시 찾기`, onClick: refreshActiveCandidates, disabled: searching, icon: <RefreshCw size={17} />, amountLabel: "선택 필요", amount: `${activeLines.length - selectedCount}종` };
      return { label: defaultReviewCount > 0 ? "선택한 상품 확인하기" : `${activeLines.length}종 상세 확인하기`, onClick: runPreflight, disabled: adding, icon: <ChevronRight size={19} />, amountLabel: pricedSelectedCount === activeLines.length ? "검색가 합계" : "가격 확인", amount: pricedSelectedCount === activeLines.length ? `${searchTotal.toLocaleString()}원` : `상세 확인 ${activeLines.length - pricedSelectedCount}종` };
    }
    if (step === 3) {
      if (adding && !preflight) return { label: "구매 조건 확인 중", onClick: () => undefined, disabled: true, icon: <LoaderCircle size={19} />, amountLabel: "상세 확인", amount: `${activeLines.length}종` };
      const allReady = preflightReadyCount === activeLines.length && activeLines.length > 0;
      const canPartiallyAdd = !allReady && preflightReadyCount > 0;
      return { label: allReady ? `${activeLines.length}종 장바구니에 담기` : canPartiallyAdd ? `확인된 ${preflightReadyCount}종 · 실물 ${preflightReadyPhysicalUnits}개 담기` : "다시 확인하기", onClick: allReady ? () => executeReady(false) : canPartiallyAdd ? () => executeReady(true) : runPreflight, disabled: adding, icon: allReady || canPartiallyAdd ? <ChevronRight size={19} /> : <RefreshCw size={17} />, amountLabel: allReady || canPartiallyAdd ? "검증 합계" : "확인 필요", amount: allReady || canPartiallyAdd ? `${verifiedTotal.toLocaleString()}원` : `${preflightIssueCount}개` };
    }
    const failed = cartResults.filter((result) => result.status !== "SUCCESS").length;
    return failed
      ? { label: `실패 ${failed}종 다시 시도`, onClick: retryFailed, disabled: adding, icon: <RefreshCw size={17} />, amountLabel: "성공 상품 확인가", amount: `${completedVerifiedTotal.toLocaleString()}원` }
      : { label: "새 목록 담기", onClick: () => void startNewList(), disabled: false, icon: <RefreshCw size={18} />, amountLabel: completedCartTotalKnown ? "장바구니 확인가" : "담은 상품 확인가", amount: `${(completedCartTotalKnown ? completedCartTotal : completedVerifiedTotal).toLocaleString()}원` };
  };
  const action = actionBar();
  const completionFailedCount = cartResults.filter((result) => result.status !== "SUCCESS").length;
  const completionAmount = completedCartTotalKnown ? completedCartTotal : completedVerifiedTotal;
  const nextTheme = theme === "system" ? "light" : theme === "light" ? "dark" : "system";
  const themeLabel = theme === "system" ? "\uC2DC\uC2A4\uD15C \uC124\uC815" : theme === "light" ? "\uB77C\uC774\uD2B8 \uBAA8\uB4DC" : "\uB2E4\uD06C \uBAA8\uB4DC";
  const themeIcon = theme === "system" ? <Monitor size={18} /> : theme === "light" ? <Sun size={18} /> : <Moon size={18} />;

  if (!restored) return <main className="app-shell"><p role="status">이전 작업을 불러오는 중…</p></main>;
  return (
    <main className={`app-shell${step === 4 ? " is-complete" : ""}`}>
      <header className="topbar">
        <div className="brand">
          <img className="brand-mark" src={brandIcon} alt="" aria-hidden="true" />
          <span className="brand-copy"><strong>딱담아</strong><small>확장 프로그램 v{EXTENSION_VERSION}</small></span>
        </div>
        <div className="topbar-actions">
          <button className="theme-toggle" type="button" data-testid="theme-toggle" aria-label={"\uD654\uBA74 \uD14C\uB9C8 \uC804\uD658"} title={themeLabel} onClick={() => setTheme(nextTheme)}>{themeIcon}</button>
        <button className="cart-link" type="button" onClick={() => void openCart()}><ShoppingBag size={19} />장바구니<ChevronRight size={17} /></button>
        </div>
      </header>
      <StepProgress step={step} />
      {step > 1 && step < 4 && <div className="flow-navigation"><button className="back-button" type="button" onClick={goBack} disabled={adding || searching}><ArrowLeft size={17} />이전</button><button className="append-nav-button" type="button" onClick={openAppendList} disabled={adding || searching}><Plus size={16} />목록 더 추가</button></div>}

      <div className={`screen-content${step === 4 ? " completion-content" : ""}`}>
        {pendingIncomingPlan && <section className="recovery" aria-label="새 쇼핑 계획 수신">
          <div><strong>새 쇼핑 계획이 도착했어요</strong><small>현재 목록은 그대로 유지했습니다. 새 계획으로 바꾸려면 아래 버튼을 눌러 주세요.</small></div>
          <button type="button" disabled={adding || searching || planLinkBusy} onClick={() => void importPlanLink(pendingIncomingPlan)}>새 계획 불러오기</button>
        </section>}
        {step === 1 && (
          <>
            <section className="screen-heading list-heading">
              <div>
                <h1>{lines.length ? `상품 ${lines.length}종 · 실물 ${physicalUnits(lines)}개` : "쇼핑 목록을 준비해 주세요"}</h1>
                <p>{lines.length ? "규격과 수량을 확인한 뒤 실제 상품을 찾아요." : "ChatGPT에서 받거나 직접 붙여넣을 수 있어요."}</p>
              </div>
            </section>
            <section className="coupang-login-card" aria-label="쿠팡 로그인 안내">
              <p role="status">쿠팡 로그인: {shopLogin === "SIGNED_IN" ? "로그인됨 (열린 페이지 기준)" : shopLogin === "SIGNED_OUT" ? "로그인 안 됨 (열린 페이지 기준)" : shopLogin === "CHECKING" ? "확인 중…" : "확인 불가 — 쿠팡 페이지를 연 뒤 확인해 주세요"}</p>
              <button type="button" onClick={() => void checkShopLogin()} disabled={shopLogin === "CHECKING"}>로그인 상태 확인</button>
              <div><strong>장보기 전에 쿠팡에 로그인해 주세요</strong><p>같은 Chrome에서 로그인한 뒤 돌아와 ‘실제 상품 찾기’를 눌러 주세요. 이미 로그인했다면 그대로 진행하셔도 됩니다.</p></div>
              <a href="https://login.coupang.com/login/login.pang" target="_blank" rel="noopener noreferrer">쿠팡 로그인하기 <ExternalLink size={16} aria-hidden="true" /></a>
            </section>
            {recoverable && (
              <section className="recovery" aria-label="중단된 장바구니 작업">
                <div><strong>중단된 담기 작업이 있어요</strong><small>현재 장바구니를 확인한 뒤 남은 수량만 이어서 담습니다.</small></div>
                <div><button type="button" onClick={clearJournal}>기록 지우기</button><button type="button" className="resume" disabled={adding} onClick={resumeJournal}>이어서 담기</button></div>
              </section>
            )}
            {renderPlanBridge()}
            <div className="entry-divider"><span>또는</span></div>
            <section className="list-input">
              <label htmlFor="shopping-list">직접 붙여넣기</label>
              <textarea id="shopping-list" value={input} onChange={(event) => setInput(event.target.value)} placeholder={"상품을 한 줄에 하나씩 입력해 주세요.\n예: 생수 2L 6개"} spellCheck={false} />
              <div className="input-actions"><button type="button" onClick={() => { setInput(SAMPLE); resetAfterInput(parseShoppingList(SAMPLE)); }}>예시 불러오기</button><button type="button" onClick={parseOnly}>{lines.length ? "전체 목록 다시 인식" : "목록 인식"}</button></div>
            </section>
            {lines.length > 0 && (
              <section className="list-append" aria-label="기존 목록에 상품 추가">
                <div><strong>목록 더 추가</strong><small>기존 GPT 목록과 이미 고른 후보는 유지됩니다.</small></div>
                <textarea aria-label="추가할 쇼핑 목록" value={appendInput} onChange={(event) => setAppendInput(event.target.value)} placeholder={"추가할 상품만 한 줄에 하나씩 입력하세요.\n예: 물티슈 80매 2개"} spellCheck={false} />
                <button type="button" onClick={() => void appendShoppingList()} disabled={searching || !appendInput.trim()}><Plus size={16} />목록에 추가하고 상품 찾기</button>
              </section>
            )}
            {lines.length > 0 && <div className="parsed-summary"><CheckCircle2 size={16} /><span>{lines.length}개 줄을 상품 {lines.length}종 · 실물 {physicalUnits(lines)}개로 인식했어요.</span></div>}
          </>
        )}
        {step === 2 && renderSelection()}
        {step === 3 && renderReview()}
        {step === 4 && renderComplete()}
        {notice && <div className="notice" role="status" aria-live="polite"><span>{notice}</span><button type="button" onClick={() => setNotice(null)}>닫기</button></div>}
        {AFFILIATE_ENABLED && <p className="affiliate">쿠팡 파트너스 활동을 통해 일정액의 수수료를 받을 수 있습니다.</p>}
      </div>

      <footer className={`sticky-action${step === 4 ? " completion-sticky" : ""}`}>
        {step === 4 ? (
          <>
            <div className="action-summary completion-summary"><small>{completedCartTotalKnown ? "장바구니 확인가" : "담은 상품 확인가"}</small><strong data-testid="estimated-total">{completionAmount.toLocaleString()}원</strong></div>
            <div className="completion-footer-actions">
              {completionFailedCount > 0 && (
                <button className="completion-retry" type="button" onClick={() => void retryFailed()} disabled={adding}>
                  {adding ? <LoaderCircle className="spin" size={17} /> : <RefreshCw size={17} />}실패 {completionFailedCount}종 다시 시도
                </button>
              )}
              <button className="completion-new-list" type="button" onClick={() => void startNewList()}><RefreshCw size={17} />새 목록 담기</button>
              <button className="completion-open-cart" type="button" onClick={() => void openCart()}><ShoppingBag size={18} />쿠팡 장바구니 보기</button>
            </div>
          </>
        ) : (
          <>
            <div className="action-summary"><small>{action.amountLabel}</small><strong data-testid="estimated-total">{action.amount}</strong></div>
            <button className="primary-action" type="button" onClick={action.onClick} disabled={action.disabled}>
              {adding || searching ? <LoaderCircle className="spin" size={18} /> : action.icon}{adding ? "확인 중…" : searching ? "상품 찾는 중…" : action.label}
            </button>
          </>
        )}
      </footer>
    </main>
  );
}
