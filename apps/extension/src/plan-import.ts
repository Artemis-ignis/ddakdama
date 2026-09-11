import { parseShoppingLine, shoppingRequestLineSchema, type ShoppingRequestLine } from "@ddakdama/core";

/** A plan can redact its original prose while retaining the structured item.
 * Rebuild editable shopping text from that structure, including quantity edits. */
export function restorePlanRequest(value: unknown): ShoppingRequestLine {
  const parsed = shoppingRequestLineSchema.safeParse(value);
  if (!parsed.success) {
    const legacy = value as { rawText?: string; normalizedText?: string } | null;
    const text = legacy?.normalizedText || legacy?.rawText;
    if (!text || text === "입력 원문은 저장하지 않음") throw new Error("INVALID_PLAN_ITEM");
    return parseShoppingLine(text);
  }
  const request = parsed.data;
  const sizeRange = request.variantTokens.find(token => token.startsWith("size-range:"))?.match(/^size-range:([\d.]+)-([\d.]+):(.+)$/u);
  const text = [
    request.productName,
    request.unitSizeValue ? `${request.unitSizeValue}${request.unitSizeUnit}` : sizeRange ? `${sizeRange[1]}~${sizeRange[2]}${sizeRange[3]}` : "",
    request.strengthValue ? `${request.strengthValue}${request.strengthUnit}` : "",
    request.packageContentCount ? `${request.packageContentCount}${request.packageContentUnit}` : "",
    `${request.requestedPhysicalUnits}개`,
  ].filter(Boolean).join(" ");
  return { ...request, rawText: text, normalizedText: text };
}
