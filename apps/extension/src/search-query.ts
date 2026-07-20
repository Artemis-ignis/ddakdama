import { parseShoppingLine, searchQueryForShoppingLine } from "@ddakdama/core";

const hasIdentity = (value: string) =>
  Boolean(value.replace(/[\d\s.~x×]/gu, "").trim());

/** Browser search begins with the original list line, never a host projection. */
export function searchQueriesFromRawText(rawText: string) {
  const line = parseShoppingLine(rawText);
  const primary = searchQueryForShoppingLine(line).trim();
  const alternatives = line.productName
    .split(/\s+\uB610\uB294\s+/u, 2)
    .map((value) => value.trim())
    .filter(hasIdentity);

  return [...new Set([primary, ...alternatives].filter(hasIdentity))].slice(0, 3);
}
