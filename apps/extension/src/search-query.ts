import { parseShoppingLine, searchQueryForShoppingLine } from "@ddakdama/core";

const hasIdentity = (value: string) =>
  Boolean(value.replace(/[\d\s.~x×]/gu, "").trim());

export type SearchQueryStage = "ORIGINAL" | "BRAND_AND_PRODUCT" | "CORE_PRODUCT";
export type SearchQueryPlan = { stage: SearchQueryStage; query: string };

const withoutListMarker = (value: string) => value.trim().replace(/^\d{1,3}[.)]\s*/u, "").replace(/\s+/gu, " ");

/**
 * Search is intentionally broader than automatic selection.  Coupang can
 * match a full request differently from its title, so preserve the original
 * request first and only relax to identity terms in later attempts.
 */
export function searchQueryPlanFromRawText(rawText: string): SearchQueryPlan[] {
  const line = parseShoppingLine(rawText);
  const original = withoutListMarker(rawText);
  const brandAndProduct = searchQueryForShoppingLine(line).trim();
  const alternatives = line.productName
    .split(/\s+\uB610\uB294\s+/u, 2)
    .map((value) => value.trim())
    .filter(hasIdentity);
  const inferredCore = line.brand
    ? line.productName.replace(new RegExp(`^${line.brand.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&")}\\s*`, "u"), "").trim()
    : line.productName.split(/\s+/u).slice(1).join(" ").trim();
  const coreProduct = (alternatives.length > 1 ? alternatives.at(-1) : undefined) || inferredCore || brandAndProduct;
  const candidates: SearchQueryPlan[] = [
    { stage: "ORIGINAL", query: original },
    { stage: "BRAND_AND_PRODUCT", query: brandAndProduct },
    { stage: "CORE_PRODUCT", query: coreProduct },
  ];
  const seen = new Set<string>();
  return candidates.filter(({ query }) => {
    const key = query.trim();
    if (!hasIdentity(key) || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export const searchQueriesFromRawText = (rawText: string) =>
  searchQueryPlanFromRawText(rawText).map(({ query }) => query);
