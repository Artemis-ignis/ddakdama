import type { ShoppingRequestLine } from "./schemas.js";

export const clarificationStatuses = ["REQUIRED", "ANSWERED", "SKIPPED"] as const;
export type ClarificationStatus = (typeof clarificationStatuses)[number];

export type ClarificationOption = {
  id: string;
  label: string;
  example?: string;
};

export type Clarification = {
  id: string;
  itemId: string;
  question: string;
  options: ClarificationOption[];
  allowFreeText: boolean;
  confidence: number;
  status: ClarificationStatus;
  answer: string | null;
  source: "RULE" | "AI";
};

const option = (id: string, label: string, example?: string): ClarificationOption => ({ id, label, ...(example ? { example } : {}) });

const normalized = (value: string) => value.replace(/\s+/gu, "").toLocaleLowerCase("ko-KR");

/**
 * Provides a safe deterministic question before any external product search.
 * AI may replace the wording/options later, but this fallback must always work
 * when the provider is unavailable or over quota.
 */
export function buildClarificationForRequest(request: ShoppingRequestLine): Clarification | null {
  const text = normalized(request.productName || request.rawText);
  if (!text) return null;

  if (["소고기", "돼지고기", "닭고기", "고기"].some((token) => text === token || text.endsWith(token))) {
    return {
      id: `clarify-${request.id}`,
      itemId: request.id,
      question: "어떤 용도로 찾으시나요?",
      options: [
        option("stew", "국거리"),
        option("grill", "구이용"),
        option("bulgogi", "불고기용"),
        option("hotpot", "샤브샤브용"),
      ],
      allowFreeText: true,
      confidence: request.parserConfidence,
      status: "REQUIRED",
      answer: null,
      source: "RULE",
    };
  }

  const shortOrGeneric = text.length <= 2 || ["샴푸", "세제", "크림", "로션", "선크림", "화장지"].includes(text);
  if (shortOrGeneric && request.unitSizeValue === null && request.packageContentCount === null) {
    return {
      id: `clarify-${request.id}`,
      itemId: request.id,
      question: "원하는 용도나 규격을 알려주시겠어요?",
      options: [
        option("basic", "기본형"),
        option("large", "대용량"),
        option("gentle", "저자극"),
      ],
      allowFreeText: true,
      confidence: request.parserConfidence,
      status: "REQUIRED",
      answer: null,
      source: "RULE",
    };
  }

  return null;
}

export function answerClarification(
  request: ShoppingRequestLine,
  clarification: Clarification,
  answer: string,
  source: "RULE" | "AI" = clarification.source,
): { request: ShoppingRequestLine; clarification: Clarification } {
  const cleanAnswer = answer.trim().replace(/\s+/gu, " ");
  if (!cleanAnswer) throw new Error("CLARIFICATION_ANSWER_REQUIRED");
  const nextText = `${request.productName} ${cleanAnswer}`.trim();
  return {
    request: {
      ...request,
      normalizedText: nextText,
      productName: nextText,
      variantTokens: [...request.variantTokens, `clarification:${cleanAnswer}`].slice(-30),
      parserConfidence: Math.max(request.parserConfidence, 0.9),
      parseWarnings: request.parseWarnings.filter((warning) => !warning.includes("확인")),
    },
    clarification: {
      ...clarification,
      status: "ANSWERED",
      answer: cleanAnswer,
      source,
    },
  };
}

export function nextRequiredClarification(items: Array<{ clarification?: Clarification | null }>): Clarification | null {
  return items.find((item) => item.clarification?.status === "REQUIRED")?.clarification ?? null;
}
