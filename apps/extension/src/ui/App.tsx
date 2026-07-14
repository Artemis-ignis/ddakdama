import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  ArrowLeft,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  CircleHelp,
  Link2,
  LoaderCircle,
  RefreshCw,
  Search,
  ShoppingBag,
  Unlink,
} from "lucide-react";
import { parseShoppingList, type ShoppingRequestLine } from "@ddakdama/core";
import brandIcon from "../../assets/icon-48.png";
import {
  candidateMatchesRequest,
  selectBestCandidate,
} from "../candidate-selection.js";

const SAMPLE = `닥터지 레드 블레미쉬 포 맨 진정 올인원 150ml
스킨1004 히알루 시카 워터핏 선 세럼 50ml 2개
라운드랩 1025 독도 클렌저 150ml 2개
TS 골드플러스 샴푸 500g
닥터스베스트 고흡수 마그네슘 100mg 240정`;

const SERVER_ORIGIN = (import.meta.env.VITE_DDAKDAMA_SERVER_ORIGIN || "http://localhost:8787").replace(/\/$/, "");
const AFFILIATE_ENABLED = import.meta.env.VITE_DDAKDAMA_AFFILIATE_ENABLED === "true";
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
  imageUrl: string | null;
  rocketDelivery: boolean;
  rating: number | null;
  reviewCount: number | null;
  advertised: boolean;
  source: "BROWSER" | "PARTNERS";
};

export type SearchGroup = { requestLineId: string; results: SearchCandidate[]; error?: string };
export type PreviewState = {
  groups?: SearchGroup[];
  step?: number;
  preflight?: boolean;
  preflightResults?: Array<{ id: string; status: string; verifiedPrice?: number }>;
  cartResults?: Array<{ id: string; status: string }>;
  notice?: string;
};

type CartJob = {
  id: string;
  productUrl: string;
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
  id: string;
  status: string;
  productUrl?: string;
  expectedProductName?: string;
  beforeQuantity?: number;
  afterQuantity?: number;
  verifiedPrice?: number;
  cartPrice?: number;
  expectedSubtotal?: number;
  priceDifference?: number;
};

type RecoverableJournal = { runId: string; jobs: CartJob[]; results: CartResult[] };
type PairingState = "idle" | "code" | "connected" | "unavailable";

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

const statusMessage = (status?: string) =>
  ({
    PRICE_UNVERIFIED: "현재 판매가격을 확인하지 못해 자동으로 담지 않았습니다.",
    PRODUCT_MISMATCH: "요청한 규격과 상품 페이지의 규격이 일치하지 않습니다.",
    QUANTITY_MISMATCH: "요청한 수량과 실제 장바구니 수량이 달라 확인이 필요합니다.",
    OPTION_REQUIRED: "필수 옵션을 직접 선택해야 하는 상품입니다.",
    OUT_OF_STOCK: "현재 품절이거나 재고를 확인하지 못했습니다.",
    LOGIN_REQUIRED: "쿠팡 로그인이 필요합니다.",
    SECURITY_CHECK_REQUIRED: "쿠팡의 보안 확인이 필요합니다.",
    CART_VERIFICATION_FAILED: "장바구니 수량 변화를 확인하지 못했습니다.",
  })[status ?? ""] ?? "상품을 담지 못했습니다.";

const searchErrorMessage = (error?: string) =>
  ({
    SECURITY_CHECK_REQUIRED: "쿠팡의 보안 확인이 필요합니다.",
    LOGIN_REQUIRED: "쿠팡 로그인이 필요합니다.",
    DOM_PARSE_FAILED: "쿠팡 검색 화면을 읽지 못했습니다.",
    NO_RESULTS: "일치하는 검색 결과를 찾지 못했습니다.",
    CONTENT_SCRIPT_UNAVAILABLE: "쿠팡 검색 연결이 늦어지고 있습니다.",
  })[error ?? ""] ?? "상품 검색을 완료하지 못했습니다.";

const purchaseQuantity = (line: ShoppingRequestLine, item: SearchCandidate, manuallySelected = false) =>
  manuallySelected
    ? Math.ceil(line.requestedPhysicalUnits / item.unitsPerPackage)
    : line.requestedPhysicalUnits / item.unitsPerPackage;

const priceBreakdown = (price: number, line: ShoppingRequestLine, item: SearchCandidate, manuallySelected = false) => {
  const quantity = purchaseQuantity(line, item, manuallySelected);
  const subtotal = price * quantity;
  return quantity > 1
    ? `${price.toLocaleString()}원 × ${quantity}개 = ${subtotal.toLocaleString()}원`
    : `${subtotal.toLocaleString()}원`;
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
  if (result.status !== "SUCCESS") return statusMessage(result.status);
  if (!line || !item) return "요청한 수량을 장바구니에서 확인했습니다.";
  const quantity = purchaseQuantity(line, item, manuallySelected);
  const packageLabel = item.unitsPerPackage > 1
    ? `${item.unitsPerPackage}개 묶음 ${quantity}세트 담음`
    : `단품 ${quantity}개 담음`;
  const parts = [`${packageLabel} · 실물 ${line.requestedPhysicalUnits}개`];
  if (result.verifiedPrice) parts.push(priceBreakdown(result.verifiedPrice, line, item));
  const verifiedSubtotal = result.verifiedPrice ? result.verifiedPrice * quantity : null;
  if (result.cartPrice && result.cartPrice !== verifiedSubtotal) parts.push(`장바구니 표시 ${result.cartPrice.toLocaleString()}원`);
  if (result.priceDifference !== undefined) {
    parts.push(`차액 ${result.priceDifference > 0 ? "+" : ""}${result.priceDifference.toLocaleString()}원`);
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
  return item?.imageUrl ? (
    <img className="product-image" src={item.imageUrl} alt="" />
  ) : (
    <span className="product-image placeholder" aria-hidden="true"><ShoppingBag size={19} /></span>
  );
}

export function App({ preview }: { preview?: PreviewState } = {}) {
  const initialInput = (preview?.step ?? 1) > 1 ? SAMPLE : "";
  const [input, setInput] = useState(initialInput);
  const [lines, setLines] = useState(() => parseShoppingList(initialInput));
  const [expanded, setExpanded] = useState(-1);
  const [step, setStep] = useState(preview?.step ?? 1);
  const [notice, setNotice] = useState<string | null>(preview?.notice ?? null);
  const [groups, setGroups] = useState<SearchGroup[]>(preview?.groups ?? []);
  const [selectedIds, setSelectedIds] = useState<Record<string, string>>({});
  const [searchQueries, setSearchQueries] = useState<Record<string, string>>({});
  const [searchingLineId, setSearchingLineId] = useState<string | null>(null);
  const [searching, setSearching] = useState(false);
  const [, setPreflight] = useState(preview?.preflight ?? false);
  const [preflightResults, setPreflightResults] = useState<CartResult[]>(
    preview?.preflightResults ?? (preview?.preflight ? lines.map((line) => ({ id: line.id, status: "READY" })) : []),
  );
  const [adding, setAdding] = useState(false);
  const [cartResults, setCartResults] = useState<CartResult[]>(preview?.cartResults ?? []);
  const [pairingCode, setPairingCode] = useState<string | null>(null);
  const [pairingState, setPairingState] = useState<PairingState>("idle");
  const [pairingBusy, setPairingBusy] = useState(false);
  const [recoverable, setRecoverable] = useState<RecoverableJournal | null>(null);
  const cartRunId = useRef<string | null>(null);

  useEffect(() => {
    if (typeof chrome === "undefined" || !chrome.runtime?.sendMessage) return;
    void chrome.runtime.sendMessage({ type: "DDAKDAMA_GET_CART_JOURNAL" })
      .then((response) => setRecoverable(response?.journal ?? null))
      .catch(() => undefined);
    void chrome.storage.local.get(["ddakdama-device-token", "ddakdama-pairing-code", "ddakdama-pairing-expires-at"]).then((stored) => {
      if (!stored["ddakdama-device-token"]) return;
      const code = String(stored["ddakdama-pairing-code"] ?? "");
      const expiresAt = Number(stored["ddakdama-pairing-expires-at"] ?? 0);
      if (/^\d{6}$/.test(code) && expiresAt > Date.now()) {
        setPairingCode(code);
        setPairingState("code");
      } else {
        setPairingState("connected");
      }
    });
  }, []);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(null), 5_500);
    return () => window.clearTimeout(timer);
  }, [notice]);

  const selected = useMemo(
    () => Object.fromEntries(lines.map((line) => {
      const results = groups.find((group) => group.requestLineId === line.id)?.results ?? [];
      const manuallySelected = results.find((item) => item.id === selectedIds[line.id]);
      return [line.id, manuallySelected ?? selectBestCandidate(line, results)];
    })) as Record<string, SearchCandidate | null>,
    [lines, groups, selectedIds],
  );

  const selectedCount = lines.filter((line) => selected[line.id]).length;
  const pricedSelectedCount = lines.filter((line) => Number(selected[line.id]?.currentPrice) > 0).length;
  const searchTotal = lines.reduce((sum, line) => {
    const item = selected[line.id];
    const manuallySelected = Boolean(item && selectedIds[line.id] === item.id);
    return sum + (item?.currentPrice ?? 0) * (item ? purchaseQuantity(line, item, manuallySelected) : 0);
  }, 0);
  const preflightReadyCount = preflightResults.filter((result) => result.status === "READY").length;
  const preflightIssueCount = preflightResults.filter((result) => result.status !== "READY").length;
  const preflightReadyIds = new Set(preflightResults.filter((result) => result.status === "READY").map((result) => result.id));
  const preflightReadyPhysicalUnits = lines.reduce((sum, line) => sum + (preflightReadyIds.has(line.id) ? line.requestedPhysicalUnits : 0), 0);
  const verifiedTotal = preflightResults.reduce((sum, result) => {
    if (result.status !== "READY") return sum;
    const line = lines.find((candidate) => candidate.id === result.id);
    const item = selected[result.id];
    if (!line || !item) return sum;
    return sum + (result.verifiedPrice ?? 0) * purchaseQuantity(line, item, selectedIds[line.id] === item.id);
  }, 0);

  const resetAfterInput = (nextLines: ShoppingRequestLine[]) => {
    cartRunId.current = null;
    setLines(nextLines);
    setGroups([]);
    setSelectedIds({});
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

  const searchAll = async () => {
    const next = parseShoppingList(input);
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
      setNotice(exact === next.length
        ? "요청한 규격과 수량이 정확히 일치하는 상품을 찾았습니다."
        : `정확히 일치하는 상품 ${exact}종 · 직접 확인이 필요한 상품 ${next.length - exact}종입니다.`);
    } catch {
      setNotice("쿠팡 검색을 완료하지 못했습니다. 잠시 후 다시 시도해 주세요.");
    } finally {
      setSearching(false);
    }
  };

  const makeJobs = (): CartJob[] => lines.flatMap((line) => {
    const item = selected[line.id];
    if (!item) return [];
    const manuallySelected = selectedIds[line.id] === item.id;
    return [{
      id: line.id,
      productUrl: item.productUrl,
      productId: item.productId,
      vendorItemId: item.vendorItemId,
      itemId: item.itemId,
      cartPurchaseQuantity: purchaseQuantity(line, item, manuallySelected),
      expectedBrand: manuallySelected ? null : line.brand,
      expectedProductName: manuallySelected ? item.title : line.productName,
      expectedUnitsPerPackage: item.unitsPerPackage,
      expectedUnitSize: manuallySelected ? null : line.unitSizeValue ? `${line.unitSizeValue}${line.unitSizeUnit}` : null,
      expectedStrength: manuallySelected ? null : line.strengthValue ? `${line.strengthValue}${line.strengthUnit}` : null,
      expectedPackageContent: manuallySelected ? null : line.packageContentCount ? `${line.packageContentCount}${line.packageContentUnit}` : null,
      status: "QUEUED" as const,
    }];
  });

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
      setNotice(nextGroup.results.length ? `${line.productName} 후보 ${nextGroup.results.length}개를 찾았습니다.` : "검색된 후보가 없습니다. 검색어를 더 간단히 바꿔 보세요.");
    } catch {
      setNotice("이 상품의 후보를 다시 찾지 못했습니다. 잠시 후 재시도해 주세요.");
    } finally {
      setSearchingLineId(null);
    }
  };

  const runPreflight = async () => {
    if (adding || selectedCount !== lines.length) return;
    setAdding(true);
    try {
      const response = await chrome.runtime.sendMessage({ type: "DDAKDAMA_PREFLIGHT", jobs: makeJobs() });
      const results = (response?.results ?? []) as CartResult[];
      setPreflightResults(results);
      setPreflight(true);
      setStep(3);
      const ready = results.filter((result) => result.status === "READY").length;
      setNotice(ready === lines.length
        ? `상품 ${lines.length}종의 현재 가격과 규격을 확인했습니다.`
        : `${lines.length - ready}개 상품은 현재 가격 또는 규격을 다시 확인해야 합니다.`);
    } catch {
      setNotice("상품 상세정보를 확인하지 못했습니다. 다시 시도해 주세요.");
    } finally {
      setAdding(false);
    }
  };

  const finishRun = async (results: CartResult[]) => {
    setCartResults(results);
    setRecoverable(null);
    const success = results.filter((result) => result.status === "SUCCESS").length;
    setStep(4);
    setNotice(success === lines.length
      ? `요청한 상품 ${success}종을 모두 검증해 담았습니다.`
      : `성공 ${success}종 · 실패 ${lines.length - success}종입니다. 실패 상품을 확인해 주세요.`);
    await chrome.runtime.sendMessage({ type: "DDAKDAMA_OPEN_CART" });
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
      const combined = lines.map((line) =>
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
    if (!partial && readyJobs.length !== lines.length) return;
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
      const response = await fetch(`${SERVER_ORIGIN}/api/pairing/start`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{}",
      });
      if (!response.ok) throw new Error("PAIRING_START_FAILED");
      const data = await response.json() as { code: string; deviceId: string; deviceToken: string; expiresAt?: number };
      await chrome.storage.local.set({
        "ddakdama-device-id": data.deviceId,
        "ddakdama-device-token": data.deviceToken,
        "ddakdama-pairing-code": data.code,
        "ddakdama-pairing-expires-at": data.expiresAt ?? Date.now() + 10 * 60_000,
      });
      setPairingCode(data.code);
      setPairingState("code");
      setNotice("ChatGPT 딱담아 앱에 이 6자리 코드를 입력해 주세요.");
    } catch {
      setPairingState("unavailable");
      setNotice("GPT 앱 연결을 시작하지 못했습니다. 잠시 후 다시 시도해 주세요.");
    } finally {
      setPairingBusy(false);
    }
  };

  const importFromGpt = async () => {
    setPairingBusy(true);
    try {
      const stored = await chrome.storage.local.get(["ddakdama-device-token"]);
      const token = String(stored["ddakdama-device-token"] ?? "");
      if (!token) {
        setNotice("먼저 연결 코드를 만들어 ChatGPT 앱에 입력해 주세요.");
        return;
      }
      const response = await fetch(`${SERVER_ORIGIN}/api/handoffs/latest`, {
        headers: { authorization: `Bearer ${token}` },
      });
      if (!response.ok) throw new Error("HANDOFF_FETCH_FAILED");
      const data = await response.json() as { handoff: null | { id: string; payload: { items?: Array<{ rawText?: string }> } } };
      if (!data.handoff) {
        setPairingState("connected");
        await chrome.storage.local.remove(["ddakdama-pairing-code", "ddakdama-pairing-expires-at"]);
        setNotice("연결됐습니다. ChatGPT 딱담아 앱에서 목록을 보낸 뒤 ‘목록 받기’를 눌러 주세요.");
        return;
      }
      const raw = (data.handoff.payload.items ?? []).map((item) => item.rawText?.trim()).filter(Boolean).join("\n");
      if (!raw) throw new Error("EMPTY_HANDOFF");
      setInput(raw);
      resetAfterInput(parseShoppingList(raw));
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
      setNotice("ChatGPT 앱에서 보낸 쇼핑 목록을 불러왔습니다.");
    } catch {
      setPairingState("unavailable");
      setNotice("GPT 앱 목록을 가져오지 못했습니다. 새 연결 코드를 만들어 다시 연결해 주세요.");
    } finally {
      setPairingBusy(false);
    }
  };

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
      setPairingState("idle");
      setPairingBusy(false);
      setNotice("GPT 앱 연결을 해제했습니다.");
    }
  };

  const openCart = () => chrome?.runtime?.sendMessage
    ? chrome.runtime.sendMessage({ type: "DDAKDAMA_OPEN_CART" })
    : window.open("https://cart.coupang.com/cartView.pang");
  const openProduct = (lineId: string) => {
    const url = selected[lineId]?.productUrl;
    if (url && chrome?.tabs?.create) void chrome.tabs.create({ url });
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
      const result = response?.results?.[0] as CartResult | undefined;
      if (!result) throw new Error("EMPTY_RESULT");
      setCartResults((current) => [...current.filter((item) => item.id !== lineId), result]);
      setNotice(result.status === "SUCCESS" ? "해당 상품을 정확한 수량으로 담았습니다." : statusMessage(result.status));
      await chrome.runtime.sendMessage({ type: "DDAKDAMA_OPEN_CART" });
    } catch {
      setNotice("재시도하지 못했습니다. 상품 페이지에서 상태를 확인해 주세요.");
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
    <section className={`gpt-bridge ${pairingState}`} aria-label="ChatGPT 목록 연결">
      <span className="gpt-bridge-icon"><Link2 size={19} /></span>
      <div className="gpt-bridge-copy" aria-live="polite">
        <strong>ChatGPT에서 목록 받기</strong>
        {pairingState === "code" && pairingCode ? (
          <small>ChatGPT 딱담아 앱에 아래 코드를 입력하세요.</small>
        ) : pairingState === "connected" ? (
          <small><CheckCircle2 size={13} /> 연결됨 · 보낸 목록을 바로 받을 수 있어요</small>
        ) : pairingState === "unavailable" ? (
          <small>연결을 시작하지 못했어요. 다시 시도해 주세요.</small>
        ) : (
          <small>6자리 코드 한 번이면 연결돼요</small>
        )}
      </div>
      {pairingState === "code" && pairingCode ? (
        <div className="gpt-code-row">
          <output className="pairing-code" aria-label={`연결 코드 ${pairingCode}`}>{pairingCode.slice(0, 3)} {pairingCode.slice(3)}</output>
          <button type="button" className="receive" onClick={importFromGpt} disabled={pairingBusy}>
            {pairingBusy ? <LoaderCircle className="spin" size={15} /> : null}목록 받기
          </button>
          <button type="button" className="icon-button" onClick={disconnectGpt} aria-label="ChatGPT 목록 연결 해제"><Unlink size={16} /></button>
        </div>
      ) : (
        <div className="gpt-bridge-actions">
          {pairingState === "idle" || pairingState === "unavailable" ? (
            <button type="button" onClick={startPairing} disabled={pairingBusy}>연결하기</button>
          ) : (
            <button type="button" className="receive" onClick={importFromGpt} disabled={pairingBusy}>
              {pairingBusy ? <LoaderCircle className="spin" size={15} /> : null}목록 받기
            </button>
          )}
          {pairingState === "connected" && (
            <button type="button" className="icon-button" onClick={disconnectGpt} aria-label="ChatGPT 목록 연결 해제"><Unlink size={16} /></button>
          )}
        </div>
      )}
    </section>
  );

  const renderSelection = () => (
    <>
      <section className="screen-heading">
        <div><h1>상품을 확인해 주세요</h1><p>정확한 후보는 자동으로, 비슷한 후보는 직접 고를 수 있어요.</p></div>
        <span className={selectedCount === lines.length ? "status success" : "status warning"}>
          {selectedCount === lines.length ? <Check size={15} /> : <CircleHelp size={15} />}
          {selectedCount}/{lines.length}종
        </span>
      </section>
      <section className="product-group" aria-label="선택된 상품">
        {lines.map((line, index) => {
          const item = selected[line.id];
          const manuallySelected = Boolean(item && selectedIds[line.id] === item.id);
          const purchaseQty = item ? purchaseQuantity(line, item, manuallySelected) : 0;
          const selectionWarnings = item && manuallySelected ? manualSelectionWarnings(line, item) : [];
          const group = groups.find((candidate) => candidate.requestLineId === line.id);
          const results = group?.results ?? [];
          return (
            <article className={`product-row ${expanded === index ? "expanded" : ""} ${item ? "" : "needs-attention"} ${manuallySelected ? "manual-selection" : ""}`} data-testid={`product-${index}`} key={line.id}>
              <button className="product-row-main" type="button" onClick={() => setExpanded(expanded === index ? -1 : index)} aria-expanded={expanded === index}>
                <span className={item ? "selection-check" : "selection-check empty"}>{item ? <Check size={14} /> : index + 1}</span>
                <ProductImage item={item} />
                <span className="product-row-copy">
                  <strong>{item?.title ?? line.productName}</strong>
                  {manuallySelected && <em>직접 선택</em>}
                  <small>{stateLabel(line)}{item?.unitsPerPackage && item.unitsPerPackage > 1 ? ` · ${item.unitsPerPackage}개 묶음 × ${purchaseQty}` : ""}</small>
                </span>
                <span className="product-row-price">{item?.currentPrice ? <><b>{(item.currentPrice * purchaseQty).toLocaleString()}원</b>{purchaseQty > 1 && <small>{item.currentPrice.toLocaleString()}원 × {purchaseQty}</small>}</> : item ? "상세에서 가격 확인" : group?.error ? "검색 실패" : results.length ? `후보 ${results.length}개 보기` : "검색 결과 없음"}</span>
                <ChevronDown className="row-chevron" size={18} />
              </button>
              {expanded === index && (
                <div className="candidate-panel">
                  <p className={item && !selectionWarnings.length ? "match-copy" : "match-copy warning"}>
                    {manuallySelected ? "직접 선택한 상품입니다. 다음 단계에서 가격·재고·옵션을 다시 확인해요." : item ? (item.currentPrice ? "규격과 수량이 가장 잘 맞는 상품이에요." : "상품은 일치하며 현재 가격은 상세페이지에서 확인해요.") : group?.error ? searchErrorMessage(group.error) : "정확히 일치하는 상품이 없어 자동 선택하지 않았어요. 아래 후보를 직접 확인해 주세요."}
                  </p>
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
                          <span><strong>{candidate.title}</strong><small>{candidate.currentPrice ? priceBreakdown(candidate.currentPrice, line, candidate, !exact) : "상세에서 가격 확인"} · {candidate.unitsPerPackage === 1 ? `단품 × ${candidatePurchaseQuantity}` : `${candidate.unitsPerPackage}개 묶음 × ${candidatePurchaseQuantity}`}{candidate.rocketDelivery ? " · 로켓배송" : ""}{candidateWarnings.length ? " · 요청과 다름" : ""}</small></span>
                          <b>{active ? (manuallySelected ? "직접 선택" : "선택됨") : exact ? "선택" : "직접 선택"}</b>
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
    const allReady = preflightReadyCount === lines.length && lines.length > 0;
    const issues = preflightResults.filter((result) => result.status !== "READY");
    return (
      <>
        <section className="screen-heading review-heading">
          <div><h1>담기 전 확인</h1><p>실제 상품 페이지에서 가격·규격·재고를 확인했어요.</p></div>
        </section>
        <section className={allReady ? "review-summary success" : "review-summary error"} aria-live="polite">
          {allReady ? <CheckCircle2 size={22} /> : <AlertCircle size={22} />}
          <div>
            <strong>{allReady ? `${lines.length}개 상품을 모두 확인했어요` : `${preflightIssueCount}개 상품을 다시 확인해야 해요`}</strong>
            <p>{allReady ? "아래 버튼을 누를 때만 쿠팡 장바구니가 변경됩니다." : "문제가 있는 상품은 자동으로 담지 않았고 장바구니도 변경되지 않았습니다."}</p>
          </div>
        </section>
        <section className="verification-group" aria-label="상세 검증 결과">
          {lines.map((line) => {
            const result = preflightResults.find((candidate) => candidate.id === line.id);
            const ready = result?.status === "READY";
            const item = selected[line.id];
            return (
              <div className="verification-row" key={line.id}>
                <span className={ready ? "verification-dot ready" : "verification-dot"} />
                <span><strong>{line.productName}</strong><small>{ready && result.verifiedPrice && item ? `${priceBreakdown(result.verifiedPrice, line, item, selectedIds[line.id] === item.id)} · 상세 확인 완료` : ready ? "상세 확인 완료" : statusMessage(result?.status)}</small></span>
                {!ready && <button type="button" onClick={() => openProduct(line.id)}>상품 페이지</button>}
              </div>
            );
          })}
        </section>
        {!allReady && (
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
    const allSuccess = success === lines.length && lines.length > 0;
    return (
      <>
        <section className={`complete-hero ${allSuccess ? "success" : "partial"}`}>
          {allSuccess ? <CheckCircle2 size={30} /> : <AlertCircle size={30} />}
          <h1>{allSuccess ? "정확하게 모두 담았어요" : "일부 상품을 담지 못했어요"}</h1>
          <p>요청 {lines.length}종 · 성공 {success}종 · 실패 {lines.length - success}종</p>
        </section>
        <section className="result-group" aria-label="장바구니 처리 결과">
          {cartResults.map((result) => {
            const line = lines.find((item) => item.id === result.id);
            const ok = result.status === "SUCCESS";
            return (
              <div className={`result-row ${ok ? "success" : "failure"}`} key={result.id}>
                <span>{ok ? <Check size={14} /> : <AlertCircle size={15} />}</span>
                <div><strong>{line?.productName ?? result.expectedProductName ?? result.id}</strong><small>{resultMessage(result, line, line ? selected[line.id] : null, Boolean(line && selectedIds[line.id]))}</small></div>
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
      return { label: "실제 상품 찾기", onClick: searchAll, disabled: searching, icon: <Search size={18} />, amountLabel: "인식 결과", amount: `${lines.length}종 · ${physicalUnits(lines)}개` };
    }
    if (step === 2) {
      if (selectedCount !== lines.length) return { label: `${lines.length - selectedCount}종 다시 찾기`, onClick: searchAll, disabled: searching, icon: <RefreshCw size={17} />, amountLabel: "선택 필요", amount: `${lines.length - selectedCount}종` };
      return { label: `${lines.length}종 상세 확인하기`, onClick: runPreflight, disabled: adding, icon: <ChevronRight size={19} />, amountLabel: pricedSelectedCount === lines.length ? "검색가 합계" : "가격 확인", amount: pricedSelectedCount === lines.length ? `${searchTotal.toLocaleString()}원` : `상세 확인 ${lines.length - pricedSelectedCount}종` };
    }
    if (step === 3) {
      const allReady = preflightReadyCount === lines.length && lines.length > 0;
      const canPartiallyAdd = !allReady && preflightReadyCount > 0;
      return { label: allReady ? `${lines.length}종 장바구니에 담기` : canPartiallyAdd ? `확인된 ${preflightReadyCount}종 · 실물 ${preflightReadyPhysicalUnits}개 담기` : "다시 확인하기", onClick: allReady ? () => executeReady(false) : canPartiallyAdd ? () => executeReady(true) : runPreflight, disabled: adding, icon: allReady || canPartiallyAdd ? <ChevronRight size={19} /> : <RefreshCw size={17} />, amountLabel: allReady || canPartiallyAdd ? "검증 합계" : "확인 필요", amount: allReady || canPartiallyAdd ? `${verifiedTotal.toLocaleString()}원` : `${preflightIssueCount}개` };
    }
    const failed = cartResults.filter((result) => result.status !== "SUCCESS").length;
    return failed
      ? { label: `실패 ${failed}종 다시 시도`, onClick: retryFailed, disabled: adding, icon: <RefreshCw size={17} />, amountLabel: "미완료", amount: `${failed}종` }
      : { label: "쿠팡 장바구니 보기", onClick: openCart, disabled: false, icon: <ShoppingBag size={18} />, amountLabel: "처리 결과", amount: `${lines.length}/${lines.length}종` };
  };
  const action = actionBar();

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand"><img className="brand-mark" src={brandIcon} alt="" aria-hidden="true" /><strong>딱담아</strong></div>
        <button className="cart-link" type="button" onClick={openCart}><ShoppingBag size={19} />장바구니<ChevronRight size={17} /></button>
      </header>
      <StepProgress step={step} />
      {step > 1 && <button className="back-button" type="button" onClick={goBack}><ArrowLeft size={17} />이전</button>}

      <div className="screen-content">
        {step === 1 && (
          <>
            <section className="screen-heading list-heading">
              <div>
                <h1>{lines.length ? `상품 ${lines.length}종 · 실물 ${physicalUnits(lines)}개` : "쇼핑 목록을 준비해 주세요"}</h1>
                <p>{lines.length ? "규격과 수량을 확인한 뒤 실제 상품을 찾아요." : "ChatGPT에서 받거나 직접 붙여넣을 수 있어요."}</p>
              </div>
            </section>
            {recoverable && (
              <section className="recovery" aria-label="중단된 장바구니 작업">
                <div><strong>중단된 담기 작업이 있어요</strong><small>현재 장바구니를 확인한 뒤 남은 수량만 이어서 담습니다.</small></div>
                <div><button type="button" onClick={clearJournal}>기록 지우기</button><button type="button" className="resume" disabled={adding} onClick={resumeJournal}>이어서 담기</button></div>
              </section>
            )}
            {renderGptConnection()}
            <div className="entry-divider"><span>또는</span></div>
            <section className="list-input">
              <label htmlFor="shopping-list">직접 붙여넣기</label>
              <textarea id="shopping-list" value={input} onChange={(event) => setInput(event.target.value)} placeholder={"상품을 한 줄에 하나씩 입력해 주세요.\n예: 생수 2L 6개"} spellCheck={false} />
              <div className="input-actions"><button type="button" onClick={() => { setInput(SAMPLE); resetAfterInput(parseShoppingList(SAMPLE)); }}>예시 불러오기</button><button type="button" onClick={parseOnly}>{lines.length ? "다시 인식" : "목록 인식"}</button></div>
            </section>
            {lines.length > 0 && <div className="parsed-summary"><CheckCircle2 size={16} /><span>{lines.length}개 줄을 상품 {lines.length}종 · 실물 {physicalUnits(lines)}개로 인식했어요.</span></div>}
          </>
        )}
        {step === 2 && renderSelection()}
        {step === 3 && renderReview()}
        {step === 4 && renderComplete()}
        {notice && <div className="notice" role="status" aria-live="polite"><span>{notice}</span><button type="button" onClick={() => setNotice(null)}>닫기</button></div>}
        {AFFILIATE_ENABLED && <p className="affiliate">쿠팡 파트너스 활동을 통해 일정액의 수수료를 받을 수 있습니다.</p>}
      </div>

      <footer className="sticky-action">
        <div className="action-summary"><small>{action.amountLabel}</small><strong data-testid="estimated-total">{action.amount}</strong></div>
        <button className="primary-action" type="button" onClick={action.onClick} disabled={action.disabled}>
          {adding || searching ? <LoaderCircle className="spin" size={18} /> : action.icon}{adding ? "확인 중…" : searching ? "상품 찾는 중…" : action.label}
        </button>
      </footer>
    </main>
  );
}
