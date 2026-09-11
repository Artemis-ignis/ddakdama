import { useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  ArrowUpRight,
  BotMessageSquare,
  Check,
  ChevronRight,
  ClipboardList,
  Copy,
  HelpCircle,
  Mic,
  MicOff,
  Minus,
  Monitor,
  PackageCheck,
  Pencil,
  Plus,
  Send,
  MessageCircle,
  Sparkles,
  X,
} from "lucide-react";
import { cartPurchaseQuantityFor, type CartPlan, type ProductCandidate } from "@ddakdama/core";
import { requestShoppingText, requestSpecification } from "./request-summary";
import brandIcon from "../../../dist/ddakdama-chatgpt-icon-256.png";
import "./styles.css";

const base = import.meta.env.VITE_DDAKDAMA_API_ORIGIN?.replace(/\/$/, "") ?? "";
const gptUrl = import.meta.env.VITE_DDAKDAMA_GPT_URL?.trim() || "https://chatgpt.com/g/g-6a5ec60a6c308191bc5b342f67c2772d-ddagdama-syoping-doumi";
const sample = "생수 1L 12병\n비빔면 5개입";

type ApiError = { error?: string; plan?: CartPlan };

type ChromeExtensionStatus = "checking" | "missing" | "outdated" | "ready";

type ExtensionBridgeMessage = {
  error?: string;
  ok?: boolean;
  supportsPlanImport?: boolean;
  type?: string;
  version?: string;
};

type SpeechRecognitionResultLike = { [index: number]: { [index: number]: { transcript: string } } };
type SpeechRecognitionLike = {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((event: { results: SpeechRecognitionResultLike }) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
  start: () => void;
};
type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

async function request<T>(path: string, init: RequestInit = {}, accessToken?: string): Promise<T> {
  const response = await fetch(`${base}${path}`, {
    ...init,
    headers: {
      "content-type": "application/json",
      ...(accessToken ? { authorization: `Bearer ${accessToken}` } : {}),
      ...(init.headers ?? {}),
    },
  });
  const body = await response.json().catch(() => ({})) as T & ApiError;
  if (!response.ok) throw new Error(body.error ?? "REQUEST_FAILED");
  return body;
}

function delivery(candidate: ProductCandidate) {
  if (candidate.fulfillmentType === "ROCKET_FRESH") return "로켓프레시";
  if (candidate.fulfillmentType === "ROCKET" || candidate.fulfillmentType === "ROCKET_DIRECT") return "로켓배송";
  if (candidate.fulfillmentType === "SELLER_DELIVERY") return "판매자 배송";
  return "배송 방식 확인 필요";
}

function coupangSearchUrl(query: string) {
  return `https://www.coupang.com/np/search?q=${encodeURIComponent(query)}`;
}

function BrowserBrand() {
  useEffect(() => {
    const favicon = document.querySelector<HTMLLinkElement>('link[rel="icon"]') ?? document.head.appendChild(document.createElement("link"));
    favicon.rel = "icon";
    favicon.type = "image/png";
    favicon.href = brandIcon;
  }, []);
  return null;
}

function App() {
  const [list, setList] = useState(sample);
  const [storeRawConsent, setStoreRawConsent] = useState(false);
  const [analyticsSessionId] = useState(() => {
    const key = "ddakdama-analytics-session";
    const existing = window.sessionStorage.getItem(key);
    if (existing) return existing;
    const created = crypto.randomUUID();
    window.sessionStorage.setItem(key, created);
    return created;
  });
  const [plan, setPlan] = useState<CartPlan | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [mobileAppLink, setMobileAppLink] = useState<string | null>(null);
  const [mobileAppLinkExpiresAt, setMobileAppLinkExpiresAt] = useState<number | null>(null);
  const [gptGuideOpen, setGptGuideOpen] = useState(() => new URLSearchParams(window.location.search).get("guide") === "gpt");
  const [chromeExtensionStatus, setChromeExtensionStatus] = useState<ChromeExtensionStatus>("checking");
  const [chromeExtensionVersion, setChromeExtensionVersion] = useState<string | null>(null);
  const [chromeHandoffPending, setChromeHandoffPending] = useState(false);
  const [assistantOpen, setAssistantOpen] = useState(false);
  const [assistantText, setAssistantText] = useState("");
  const [assistantBusy, setAssistantBusy] = useState(false);
  const [listening, setListening] = useState(false);
  const [clarificationDrafts, setClarificationDrafts] = useState<Record<string, string>>({});
  const gptDialogRef = useRef<HTMLElement>(null);
  const gptCloseButtonRef = useRef<HTMLButtonElement>(null);

  const track = (name: string, properties: Record<string, string | number | boolean> = {}, planId?: string) => {
    void request("/api/events", {
      method: "POST",
      body: JSON.stringify({ name, sessionId: analyticsSessionId, ...(planId ? { planId } : {}), properties }),
    }).catch(() => undefined);
  };

  const selected = useMemo(
    () => plan?.items.flatMap((item) => item.candidates.filter((candidate) => candidate.id === item.selectedCandidateId)) ?? [],
    [plan],
  );
  const hasRequiredClarification = Boolean(plan?.items.some((item) => item.clarification?.status === "REQUIRED"));
  const hasCandidatesForEveryItem = Boolean(plan && !hasRequiredClarification && plan.items.every((item) => item.candidates.length > 0));
  const hasSelectedProducts = Boolean(plan && !hasRequiredClarification && selected.length === plan.items.length);
  const selectedTotal = plan && plan.items.every((item) => item.candidates.some((candidate) => candidate.id === item.selectedCandidateId && candidate.currentPrice !== null))
    ? plan.items.reduce((sum, item) => {
      const candidate = item.candidates.find((value) => value.id === item.selectedCandidateId);
      return candidate ? sum + (candidate.currentPrice ?? 0) * cartPurchaseQuantityFor(item, candidate) : sum;
    }, 0)
    : null;
  const hasAffiliateLink = selected.some((candidate) => candidate.affiliateVerified && candidate.affiliateUrl);

  const speechConstructor = (): SpeechRecognitionConstructor | null => {
    const scope = window as Window & { SpeechRecognition?: SpeechRecognitionConstructor; webkitSpeechRecognition?: SpeechRecognitionConstructor };
    return scope.SpeechRecognition ?? scope.webkitSpeechRecognition ?? null;
  };

  const startVoiceCapture = (onText: (text: string) => void) => {
    const Constructor = speechConstructor();
    if (!Constructor) {
      setNotice("이 브라우저에서는 음성 입력을 지원하지 않습니다. 글자로 입력해 주세요.");
      return;
    }
    const recognition = new Constructor();
    recognition.lang = "ko-KR";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognition.onresult = (event) => {
      const transcript = event.results[0]?.[0]?.transcript?.trim();
      if (transcript) onText(transcript);
    };
    recognition.onerror = () => {
      setListening(false);
      setNotice("음성을 알아듣지 못했어요. 글자로 입력해 주세요.");
    };
    recognition.onend = () => setListening(false);
    setListening(true);
    recognition.start();
  };

  useEffect(() => {
    track("PAGE_VIEW");
  }, []);

  useEffect(() => {
    if (!gptGuideOpen) return;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.requestAnimationFrame(() => gptCloseButtonRef.current?.focus());
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setGptGuideOpen(false);
        return;
      }
      if (event.key !== "Tab") return;
      const focusable = gptDialogRef.current?.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );
      if (!focusable?.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
      previousFocus?.focus();
    };
  }, [gptGuideOpen]);

  useEffect(() => {
    const onMessage = (event: MessageEvent<ExtensionBridgeMessage>) => {
      if (event.source !== window || event.origin !== window.location.origin) return;
      if (event.data?.type === "DDAKDAMA_EXTENSION_READY") {
        setChromeExtensionVersion(event.data.version ?? null);
        setChromeExtensionStatus(event.data.supportsPlanImport === true ? "ready" : "outdated");
      }
      if (event.data?.type === "DDAKDAMA_EXTENSION_IMPORT_RESULT") {
        setChromeHandoffPending(false);
        if (event.data.ok) {
          setNotice("Chrome 확장프로그램에서 같은 쇼핑 계획을 열었습니다. 상품과 수량을 확인해 주세요.");
        } else {
          const message = event.data.error === "INVALID_PLAN_LINK"
            ? "이 계획 링크는 만료되었거나 올바르지 않습니다. 새 계획을 만든 뒤 다시 시도해 주세요."
            : event.data.error === "HANDOFF_STORE_FAILED"
              ? "확장프로그램에 계획을 저장하지 못했습니다. 확장프로그램을 다시 열고 시도해 주세요."
              : "설치된 확장프로그램이 현재 계획 전달 기능을 지원하지 않습니다. 확장프로그램을 업데이트하거나 새로고침해 주세요.";
          setChromeExtensionStatus("outdated");
          setNotice(message);
        }
      }
    };
    window.addEventListener("message", onMessage);
    const probe = window.setTimeout(() => {
      window.postMessage({ type: "DDAKDAMA_EXTENSION_PROBE" }, window.location.origin);
    }, 200);
    const missing = window.setTimeout(() => {
      setChromeExtensionStatus((status) => status === "checking" ? "missing" : status);
    }, 1_000);
    return () => {
      window.removeEventListener("message", onMessage);
      window.clearTimeout(probe);
      window.clearTimeout(missing);
    };
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const planId = params.get("plan");
    const grant = params.get("grant");
    if (!planId || !grant) return;
    let cancelled = false;
    setBusy(true);
    void request<{ plan: CartPlan }>(`/api/plans/${planId}`, {}, grant)
      .then(async (output) => {
        const needsDiscovery = output.plan.status === "DRAFT"
          && output.plan.items.every((item) => item.candidates.length === 0);

        // Custom GPT plans are stored in the same Worker as the web, Android
        // and extension surfaces. Opening a fresh GPT link must continue into
        // DdakDama product discovery, not stop at an empty parsed list.
        if (needsDiscovery) {
          if (!cancelled) setNotice("GPT 목록으로 딱담아 상품 후보를 찾고 있어요.");
          const resolved = await request<{ plan: CartPlan; fallback?: "BROWSER_SEARCH" }>(
            `/api/plans/${output.plan.id}/resolve`,
            { method: "POST", body: "{}" },
            grant,
          );
          if (cancelled) return;
          setPlan(resolved.plan);
          setAccessToken(grant);
          setNotice(resolved.plan.items.some((item) => item.clarification?.status === "REQUIRED")
            ? "GPT 목록을 불러왔어요. 모호한 항목부터 확인해 주세요."
            : resolved.fallback === "BROWSER_SEARCH"
              ? "GPT 목록을 불러왔어요. 현재는 일반 쿠팡 검색으로 상품을 직접 비교할 수 있습니다."
              : "GPT 목록을 불러왔어요. 딱담아에서 상품 후보를 비교하고 선택해 주세요.");
          return;
        }
        if (cancelled) return;
        setPlan(output.plan);
        setAccessToken(grant);
        setNotice("GPT에서 만든 쇼핑 목록을 불러왔어요. 필요한 항목을 확인해 주세요.");
      })
      .catch(() => {
        if (!cancelled) setNotice("이 쇼핑 계획 링크는 만료되었거나 열 수 없습니다. 새 목록을 만들어 주세요.");
      })
      .finally(() => {
        if (!cancelled) setBusy(false);
      });
    return () => { cancelled = true; };
  }, []);

  const create = async () => {
    setBusy(true);
    setNotice(null);
    try {
      const output = await request<{ plan: CartPlan; accessToken: string }>("/api/plans", {
        method: "POST",
        body: JSON.stringify({ shoppingList: list, consentToStoreRaw: storeRawConsent }),
      });
      setPlan(output.plan);
      setAccessToken(output.accessToken);
      const resolved = await request<{ plan: CartPlan; fallback?: "BROWSER_SEARCH" }>(
        `/api/plans/${output.plan.id}/resolve`,
        { method: "POST", body: "{}" },
        output.accessToken,
      );
      setPlan(resolved.plan);
      track("LIST_CREATED", { itemCount: resolved.plan.items.length }, resolved.plan.id);
      if (resolved.plan.items.some((item) => item.clarification?.status === "REQUIRED")) {
        track("CLARIFICATION_SHOWN", { count: resolved.plan.items.filter((item) => item.clarification?.status === "REQUIRED").length }, resolved.plan.id);
        setNotice("검색 전에 몇 가지만 확인할게요. 원하는 용도나 규격을 골라 주세요.");
      } else if (resolved.fallback === "BROWSER_SEARCH") {
        setNotice("지금은 일반 쿠팡 검색으로 연결합니다. 파트너스 API는 승인·정책 확인 뒤에만 사용합니다.");
      }
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "목록을 만들지 못했습니다.");
    } finally {
      setBusy(false);
    }
  };

  const answerClarification = async (itemId: string, optionId?: string) => {
    if (!plan || !accessToken) return;
    const answerText = clarificationDrafts[itemId]?.trim();
    if (!optionId && !answerText) {
      setNotice("선택지를 고르거나 원하는 조건을 직접 입력해 주세요.");
      return;
    }
    setBusy(true);
    try {
      const answered = await request<{ plan: CartPlan }>(
        `/api/plans/${plan.id}/clarify`,
        { method: "POST", body: JSON.stringify({ itemId, ...(optionId ? { optionId } : { answerText }) }) },
        accessToken,
      );
      const resolved = await request<{ plan: CartPlan; fallback?: "BROWSER_SEARCH" }>(
        `/api/plans/${answered.plan.id}/resolve`,
        { method: "POST", body: "{}" },
        accessToken,
      );
      setPlan(resolved.plan);
      track("CLARIFICATION_ANSWERED", { itemId }, resolved.plan.id);
      if (resolved.plan.items.some((item) => item.clarification?.status === "REQUIRED")) {
        track("CLARIFICATION_SHOWN", { count: resolved.plan.items.filter((item) => item.clarification?.status === "REQUIRED").length }, resolved.plan.id);
      }
      setNotice(resolved.plan.items.some((item) => item.clarification?.status === "REQUIRED")
        ? "다음 항목도 확인해 주세요."
        : resolved.fallback === "BROWSER_SEARCH"
          ? "확인한 조건으로 쿠팡 검색을 준비했어요."
          : "확인한 조건으로 상품 후보를 찾았어요.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "확인 내용을 저장하지 못했습니다.");
    } finally {
      setBusy(false);
    }
  };

  const updateQuantity = async (itemId: string, delta: number) => {
    if (!plan || !accessToken) return;
    const item = plan.items.find((value) => value.id === itemId);
    if (!item) return;
    const nextQuantity = Math.max(1, item.request.requestedPhysicalUnits + delta);
    try {
      const output = await request<{ plan: CartPlan }>(
        `/api/plans/${plan.id}`,
        { method: "PATCH", body: JSON.stringify({ expectedVersion: plan.version, quantityUpdates: { [itemId]: nextQuantity } }) },
        accessToken,
      );
      setPlan(output.plan);
      track("QUANTITY_CHANGED", { itemId, delta }, output.plan.id);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "수량을 저장하지 못했습니다.");
    }
  };

  const askAssistant = async () => {
    const instruction = assistantText.trim();
    if (!instruction) return;
    setAssistantBusy(true);
    try {
      const currentList = plan?.items.map((item) => requestShoppingText(item.request)).join("\n") ?? list;
      const output = await request<{ suggestedShoppingList: string }>("/api/ai/shopping-list", {
        method: "POST",
        body: JSON.stringify({ instruction, currentList }),
      });
      track("ASSISTANT_USED", {}, plan?.id);
      setList(output.suggestedShoppingList);
      if (plan) {
        setPlan(null);
        setAccessToken(null);
        setMobileAppLink(null);
        setMobileAppLinkExpiresAt(null);
        window.history.replaceState({}, "", "/");
      }
      setAssistantText("");
      setAssistantOpen(false);
      setNotice("AI가 목록 초안을 만들었어요. 내용을 확인한 뒤 목록을 준비해 주세요.");
    } catch {
      setList((current) => current.trim() ? `${current}\n${instruction}` : instruction);
      setAssistantText("");
      setAssistantOpen(false);
      setNotice("AI 도움을 사용할 수 없어 입력한 내용을 목록에 추가했어요. 직접 확인해 주세요.");
    } finally {
      setAssistantBusy(false);
    }
  };

  const select = async (itemId: string, candidateId: string) => {
    if (!plan || !accessToken) return;
    const selectedCandidateIds = Object.fromEntries(
      plan.items
        .map((item) => [item.id, item.id === itemId ? candidateId : item.selectedCandidateId])
        .filter((entry): entry is [string, string] => Boolean(entry[1])),
    );
    try {
      const output = await request<{ plan: CartPlan }>(
        `/api/plans/${plan.id}`,
        { method: "PATCH", body: JSON.stringify({ expectedVersion: plan.version, selectedCandidateIds }) },
        accessToken,
      );
      setPlan(output.plan);
      track("CANDIDATE_SELECTED", { itemId }, output.plan.id);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "선택을 저장하지 못했습니다.");
    }
  };

  const prepareSelectedLinks = async () => {
    if (!plan || !accessToken) return;
    setBusy(true);
    setNotice(null);
    try {
      const output = await request<{ plan: CartPlan; complete: boolean; fallback?: "CANONICAL_URL" }>(
        `/api/plans/${plan.id}/finalize-affiliate-links`,
        { method: "POST", body: "{}" },
        accessToken,
      );
      setPlan(output.plan);
      track("LINK_OPENED", { selectedCount: output.plan.items.filter((item) => Boolean(item.selectedCandidateId)).length }, output.plan.id);
      setNotice(output.complete
        ? "선택한 상품 링크를 준비했어요. 아래에서 원하는 상품만 직접 열어 확인해 주세요."
        : "일반 쿠팡 상품 링크를 준비했어요. 가격·배송 조건은 쿠팡에서 직접 확인해 주세요.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "상품 링크를 준비하지 못했습니다.");
    } finally {
      setBusy(false);
    }
  };

  const editPlan = () => {
    setPlan(null);
    setAccessToken(null);
    setNotice(null);
    setMobileAppLink(null);
    setMobileAppLinkExpiresAt(null);
    window.history.replaceState({}, "", "/");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const sharePlanUrl = useMemo(() => {
    if (!plan || !accessToken) return null;
    const url = new URL(window.location.origin);
    url.searchParams.set("plan", plan.id);
    url.searchParams.set("grant", accessToken);
    return url.href;
  }, [accessToken, plan]);

  const prepareMobileAppLink = async () => {
    if (!plan || !accessToken) return;
    setBusy(true);
    try {
      const output = await request<{ appLink: string; expiresAt: number }>(
        `/api/plans/${plan.id}/claim-link`,
        { method: "POST", body: "{}" },
        accessToken,
      );
      setMobileAppLink(output.appLink);
      setMobileAppLinkExpiresAt(output.expiresAt);
      setNotice("Android 앱으로 넘길 준비가 됐어요. 아래 버튼을 눌러 딱담아 앱에서 계속하세요.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "앱 연결 링크를 준비하지 못했습니다.");
    } finally {
      setBusy(false);
    }
  };

  const copyPlanLink = async () => {
    if (!sharePlanUrl) return;
    try {
      await navigator.clipboard.writeText(sharePlanUrl);
      setNotice("Chrome 확장프로그램의 ‘딱담아 웹·GPTs 계획 불러오기’에 붙여넣어 이어갈 수 있어요.");
    } catch {
      setNotice("계획 링크를 복사하지 못했습니다. 이 브라우저의 클립보드 권한을 확인해 주세요.");
    }
  };

  const openInChromeExtension = () => {
    if (!sharePlanUrl) return;
    if (chromeExtensionStatus !== "ready") {
      window.location.assign("/support#chrome-extension");
      return;
    }
    setChromeHandoffPending(true);
    window.postMessage({ planUrl: sharePlanUrl, type: "DDAKDAMA_EXTENSION_IMPORT_PLAN" }, window.location.origin);
    window.setTimeout(() => {
      setChromeHandoffPending((pending) => {
        if (pending) {
          setChromeExtensionStatus("outdated");
          setNotice("확장프로그램이 응답하지 않습니다. 확장프로그램을 업데이트하거나 새로고침한 뒤 다시 시도해 주세요.");
          return false;
        }
        return false;
      });
    }, 1200);
  };

  return <main className="shell">
    <BrowserBrand />
    <header>
      <a className="brand" href="/"><img src={brandIcon} alt="딱담아"/><strong>딱담아</strong></a>
      <button className="gpt-link" onClick={() => setGptGuideOpen(true)} aria-haspopup="dialog"><BotMessageSquare size={17}/>GPT로 대화</button>
    </header>

    {!plan && <>
      <section className="hero">
        <div className="hero-copy">
          <p className="eyebrow">쇼핑 목록을 한 번에</p>
          <h1>필요한 상품을<br/>자유롭게 적어보세요.</h1>
          <p>GPT 없이도 바로 시작할 수 있습니다. 목록을 정리한 뒤 사용자가 직접 쿠팡 상품·가격·배송 조건을 확인합니다.</p>
        </div>
        <div className="hero-art" aria-hidden="true">
          <img src="/visuals/ddakdama-shopping-hero.png" alt="" />
          <Sparkles className="hero-mark" size={34}/>
        </div>
      </section>
      <section className="composer" aria-label="쇼핑 목록 입력">
        <label htmlFor="shopping-list">쇼핑 목록</label>
        <textarea id="shopping-list" value={list} onChange={(event) => setList(event.target.value)} placeholder="예: 생수 1L 12병"/>
        <div className="composer-foot"><span>상품마다 한 줄로 쓰면 더 정확합니다.</span><div className="composer-tools"><button type="button" onClick={() => startVoiceCapture((text) => setList((current) => current.trim() ? `${current}\n${text}` : text))}>{listening ? <MicOff size={15}/> : <Mic size={15}/>} {listening ? "듣는 중" : "음성 입력"}</button><button type="button" onClick={() => setList(sample)}>예시 불러오기</button></div></div>
        <label className="raw-consent"><input type="checkbox" checked={storeRawConsent} onChange={(event) => setStoreRawConsent(event.target.checked)} /> <span>공유 링크에서 입력 원문을 다시 보려면 원문 저장에 동의합니다. (선택)</span></label>
        <button className="primary" disabled={!list.trim() || busy} onClick={() => void create()}><ClipboardList size={19}/>{busy ? "목록 준비 중" : "목록 만들기"}</button>
      </section>
    </>}

    {notice && <p className="notice" role="status">{notice}</p>}

    {plan && <>
      <section className="result-hero">
        <span className="result-check"><Check size={24}/></span>
        <p className="eyebrow">내 쇼핑 목록</p>
        <h1>{hasRequiredClarification ? "몇 가지만 확인할게요" : hasCandidatesForEveryItem ? "상품을 비교해 보세요" : "쇼핑 목록을 준비했어요"}</h1>
        <p>{hasRequiredClarification ? "모호한 항목의 용도와 규격을 먼저 확인하면 더 정확한 상품을 찾을 수 있어요." : hasCandidatesForEveryItem ? "원하는 상품과 배송 조건을 확인한 뒤, 사용자가 직접 쿠팡 상품 페이지를 엽니다." : "입력하신 항목을 쿠팡에서 바로 검색해 확인할 수 있어요."}</p>
      </section>
      <section className="plan">
        <div className="plan-title">
          <div><span className="plan-icon">{hasRequiredClarification ? <HelpCircle size={20}/> : <ClipboardList size={20}/>}</span><div><h2>{hasRequiredClarification ? "확인 필요한 항목" : hasCandidatesForEveryItem ? "상품 비교" : `내 쇼핑 목록 (${plan.items.length}개)`}</h2><p>{hasRequiredClarification ? "선택하거나 직접 입력해 주세요." : hasCandidatesForEveryItem ? "구성과 배송 조건을 보고 원하는 상품을 고르세요." : "필요한 상품을 하나씩 확인해 보세요."}</p></div></div>
          <button className="edit-button" type="button" onClick={editPlan}><Pencil size={15}/>새 목록</button>
        </div>
        {plan.context && (plan.context.goal || plan.context.budgetWon || plan.context.notes.length > 0) && <section className="plan-context" aria-label="쇼핑 조건">
          <div>
            {plan.context.goal && <span><strong>목적</strong>{plan.context.goal}</span>}
            {plan.context.budgetWon && <span><strong>예산 목표</strong>{plan.context.budgetWon.toLocaleString()}원</span>}
          </div>
          {plan.context.notes.length > 0 && <p><strong>요청 조건</strong>{plan.context.notes.join(" · ")}</p>}
          <small>예산은 목표이며, 실제 상품가·배송비·할인은 쿠팡에서 최종 확인합니다.</small>
        </section>}
        {plan.items.map((item, index) => <article className={item.clarification?.status === "REQUIRED" ? "item clarification-item" : item.candidates.length ? "item" : "result-item"} key={item.id}>
          {item.clarification?.status === "REQUIRED" ? <>
            {index === 0 && <img className="clarification-illustration" src="/visuals/ddakdama-clarification-helper.png" alt="" loading="lazy" />}
            <div className="clarification-heading"><span className="clarification-icon"><HelpCircle size={21}/></span><div><h3>{item.request.productName}<small>{requestSpecification(item.request)}</small></h3><p>{item.clarification.question}</p></div></div>
            <div className="clarification-options">{item.clarification.options.map((option) => <button type="button" key={option.id} onClick={() => void answerClarification(item.id, option.id)}>{option.label}</button>)}</div>
            {item.clarification.allowFreeText && <div className="clarification-input"><input value={clarificationDrafts[item.id] ?? ""} onChange={(event) => setClarificationDrafts((current) => ({ ...current, [item.id]: event.target.value }))} placeholder="원하는 조건을 직접 입력" onKeyDown={(event) => { if (event.key === "Enter") void answerClarification(item.id); }}/><button type="button" onClick={() => startVoiceCapture((text) => setClarificationDrafts((current) => ({ ...current, [item.id]: text })))} aria-label="음성으로 답하기"><Mic size={17}/></button><button type="button" onClick={() => void answerClarification(item.id)}>확인</button></div>}
          </> : item.candidates.length ? <>
            <div className="item-heading"><h3>{item.request.productName}<small>{requestSpecification(item.request)}</small></h3><div className="quantity-control" aria-label={`${item.request.productName} 수량 조절`}><button type="button" onClick={() => void updateQuantity(item.id, -1)} aria-label="수량 줄이기"><Minus size={15}/></button><strong>{item.request.requestedPhysicalUnits}</strong><button type="button" onClick={() => void updateQuantity(item.id, 1)} aria-label="수량 늘리기"><Plus size={15}/></button></div></div>
            <div className="candidates">{item.candidates.map((candidate) => <button className={candidate.id === item.selectedCandidateId ? "candidate selected" : "candidate"} key={candidate.id} onClick={() => void select(item.id, candidate.id)}>
              <span className="image">{candidate.imageUrl ? <img src={candidate.imageUrl} alt="" onError={(event) => { event.currentTarget.style.display = "none"; }}/> : <PackageCheck size={22}/>}</span>
              <span className="details"><strong>{candidate.title}</strong><small>{candidate.unitsPerPackage}개 구성 · {delivery(candidate)}{candidate.deliveryPromise ? ` · ${candidate.deliveryPromise}` : ""}</small><small className="shipping">{candidate.shippingFee === null ? "배송비 확인 필요" : candidate.shippingFee === 0 ? "무료배송 확인" : `배송비 ${candidate.shippingFee.toLocaleString()}원`}</small></span>
              <b>{candidate.currentPrice ? `${candidate.currentPrice.toLocaleString()}원` : "가격 확인 필요"}</b>
            </button>)}</div>
          </> : <>
            <span className="item-number">{index + 1}</span><span className="item-icon"><PackageCheck size={23}/></span><div className="result-item-copy"><h3>{item.request.productName}</h3><p>{requestSpecification(item.request)}</p></div>
            <a href={coupangSearchUrl(requestShoppingText(item.request))} target="_blank" rel="noreferrer" referrerPolicy="no-referrer">쿠팡에서 상품 보기<ArrowUpRight size={17}/></a>
          </>}
        </article>)}

        {hasCandidatesForEveryItem && <>
          <section className="settlement"><div><span>{selectedTotal === null ? "상품가 확인 중" : "선택 상품가"}</span><strong>{selectedTotal === null ? "가격 확인 필요" : `${selectedTotal.toLocaleString()}원`}</strong></div><p>배송비·와우 혜택·쿠폰·로켓프레시 최소금액은 쿠팡 장바구니에서 로그인 상태와 배송지 기준으로 다시 확인됩니다.</p></section>
          <button className="primary" disabled={!hasSelectedProducts || busy} onClick={() => void prepareSelectedLinks()}><ChevronRight size={19}/>{busy ? "링크 준비 중" : "선택 상품을 쿠팡에서 확인하기"}</button>
        </>}

        {hasSelectedProducts && <section className="selected-links" aria-label="선택 상품 링크">
          <h3>선택한 상품</h3>
          <p>자동으로 열거나 장바구니에 담지 않습니다. 원하는 상품만 직접 열어 가격·배송·옵션을 확인해 주세요.</p>
          <div>{selected.map((candidate) => <a key={candidate.id} href={candidate.affiliateVerified && candidate.affiliateUrl ? candidate.affiliateUrl : candidate.canonicalUrl} target="_blank" rel="noreferrer" referrerPolicy="no-referrer"><span>{candidate.title}</span><ArrowUpRight size={17}/></a>)}</div>
          {hasAffiliateLink && <small className="affiliate-disclosure">이 포스팅은 쿠팡 파트너스 활동의 일환으로, 이에 따른 일정액의 수수료를 제공받습니다.</small>}
        </section>}
        {plan && accessToken && <section className="surface-continue" aria-label="다른 딱담아 화면에서 이어보기">
          <div>
            <span className="continue-icon"><Monitor size={20}/></span>
            <div><h3>PC에서 같은 목록 이어보기</h3><p>{chromeExtensionStatus === "ready"
              ? "확장프로그램" + (chromeExtensionVersion ? " v" + chromeExtensionVersion : "") + "이 연결됐습니다. 같은 계획을 바로 열어 상품과 수량을 확인할 수 있어요."
              : chromeExtensionStatus === "outdated"
                ? "확장프로그램이 감지됐지만 현재 계획 전달 기능을 지원하지 않습니다. 확장프로그램을 업데이트하거나 새로고침해 주세요."
                : chromeExtensionStatus === "checking"
                  ? "설치된 Chrome 확장프로그램을 확인하고 있어요."
                  : "Chrome 확장프로그램을 설치하면 이 계획을 코드 없이 PC에서 이어서 확인할 수 있어요."}</p></div>
          </div>
          <div className="continue-actions">
            <button type="button" onClick={openInChromeExtension} disabled={!sharePlanUrl || chromeHandoffPending || chromeExtensionStatus === "checking"}>{chromeHandoffPending ? "확장프로그램 여는 중" : chromeExtensionStatus === "ready" ? "Chrome 확장프로그램에서 계속하기" : chromeExtensionStatus === "outdated" ? "확장프로그램 업데이트 방법" : "Chrome 확장프로그램 설치 방법"}</button>
            {!mobileAppLink ? <button type="button" onClick={() => void prepareMobileAppLink()} disabled={busy}>Android 앱 연결 준비</button> : <a href={mobileAppLink}>딱담아 앱에서 열기</a>}
            <button type="button" className="secondary" onClick={() => void copyPlanLink()} disabled={!sharePlanUrl}><Copy size={16}/>계획 링크 복사</button>
          </div>
          {chromeExtensionStatus !== "ready" && <a className="extension-install-link" href="/support#chrome-extension">Chrome 확장프로그램 설치·업데이트 방법 보기 <ArrowUpRight size={14}/></a>}
          {mobileAppLinkExpiresAt && <small>앱 연결은 보안을 위해 {new Date(mobileAppLinkExpiresAt).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })}까지 한 번만 사용할 수 있습니다.</small>}
        </section>}
      </section>
    </>}

    {gptGuideOpen && <div className="modal-backdrop" role="presentation" onMouseDown={() => setGptGuideOpen(false)}>
      <section ref={gptDialogRef} className="gpt-guide" role="dialog" aria-modal="true" aria-labelledby="gpt-guide-title" onMouseDown={(event) => event.stopPropagation()}>
        <button ref={gptCloseButtonRef} className="modal-close" type="button" onClick={() => setGptGuideOpen(false)} aria-label="안내 닫기"><X size={20}/></button>
        <div className="guide-icon"><BotMessageSquare size={22}/></div>
        <h2 id="gpt-guide-title">GPT로 대화하며 목록 만들기</h2>
        <p>딱담아 GPT 베타에서는 대화로 목록을 정리한 뒤, 이 웹페이지에서 계속 확인할 수 있습니다. ChatGPT를 사용하지 않아도 이 화면의 목록 입력으로 동일하게 시작할 수 있어요.</p>
        <ol className="guide-steps">
          <li><span>1</span><div><strong>딱담아 GPT 베타 링크를 여세요</strong><small>GPT 탐색 검색 공개 전에는 안내받은 링크로 바로 엽니다.</small></div></li>
          <li><span>2</span><div><strong>필요한 상품을 대화로 말하세요</strong><small>예: “생수 1L 12병과 비빔면 5개입을 목록으로 정리해줘”</small></div></li>
          <li><span>3</span><div><strong>딱담아에서 계속 확인하세요</strong><small>상품·가격·배송 조건은 쿠팡 페이지에서 직접 최종 확인합니다.</small></div></li>
        </ol>
        <div className="guide-actions">
          {gptUrl ? <a className="primary gpt-open" href={gptUrl} target="_blank" rel="noreferrer"><ArrowUpRight size={19}/>딱담아 GPT 열기</a> : <p className="gpt-pending">딱담아 GPT 베타 링크를 준비 중입니다. 지금은 여기서 바로 목록을 입력해 주세요.</p>}
          <button type="button" className="text-action" onClick={() => setGptGuideOpen(false)}>여기서 직접 목록 입력하기</button>
        </div>
      </section>
    </div>}
    {assistantOpen && <section className="assistant-panel" aria-label="하단 AI 장보기 도우미">
      <div className="assistant-header"><div><strong>AI 장보기 도우미</strong><small>모호한 품목을 정리하거나 목록을 다듬어 드려요.</small></div><button type="button" onClick={() => setAssistantOpen(false)} aria-label="도우미 닫기"><X size={18}/></button></div>
      <textarea value={assistantText} onChange={(event) => setAssistantText(event.target.value)} placeholder="예: 욕실용 세제를 대용량으로 찾아줘" aria-label="AI에게 요청할 내용" />
      <div className="assistant-actions"><button type="button" onClick={() => startVoiceCapture(setAssistantText)}><Mic size={16}/>음성 입력</button><button type="button" className="assistant-send" onClick={() => void askAssistant()} disabled={assistantBusy || !assistantText.trim()}><Send size={16}/>{assistantBusy ? "정리 중" : "목록에 반영"}</button></div>
    </section>}
    <button type="button" className="assistant-toggle" onClick={() => setAssistantOpen((open) => !open)} aria-expanded={assistantOpen}><MessageCircle size={18}/>{assistantOpen ? "도우미 닫기" : "AI에게 물어보기"}</button>
  </main>;
}

createRoot(document.getElementById("root")!).render(<App/>);
