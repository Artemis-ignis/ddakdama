import type { ShoppingRequestLine } from "@ddakdama/core";

function specificationParts(request: ShoppingRequestLine): string[] {
  const range = request.variantTokens.find((token) => token.startsWith("size-range:"))
    ?.match(/^size-range:([\d.]+)-([\d.]+):(.+)$/u);
  return [
    request.unitSizeValue && request.unitSizeUnit
      ? `${request.unitSizeValue}${request.unitSizeUnit}`
      : range ? `${range[1]}~${range[2]}${range[3]}` : "",
    request.strengthValue && request.strengthUnit ? `${request.strengthValue}${request.strengthUnit}` : "",
    request.packageContentCount && request.packageContentUnit ? `${request.packageContentCount}${request.packageContentUnit}` : "",
  ].filter(Boolean);
}

/** Use the structured request even when original prose is redacted or its
 * quantity has changed. A privacy notice is never a product specification. */
export function requestSpecification(request: ShoppingRequestLine): string {
  return [...specificationParts(request), `실물 ${request.requestedPhysicalUnits}개`].join(" · ");
}

export function requestShoppingText(request: ShoppingRequestLine): string {
  return [request.productName, ...specificationParts(request), `${request.requestedPhysicalUnits}개`].join(" ");
}
