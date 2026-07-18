import { shoppingRequestLineSchema, type ShoppingRequestLine } from "./schemas.js";

type SizeUnit = NonNullable<ShoppingRequestLine["unitSizeUnit"]>;
type StrengthUnit = NonNullable<ShoppingRequestLine["strengthUnit"]>;
type NumericToken = { value: number; unit: string; start: number };

const sizeAliases: Record<string, SizeUnit> = {
  ml: "mL", "\uBC00\uB9AC\uB9AC\uD130": "mL",
  l: "L", "\uB9AC\uD130": "L",
  g: "g", "\uADF8\uB7A8": "g",
  kg: "kg", "\uD0AC\uB85C\uADF8\uB7A8": "kg",
};
const strengthAliases: Record<string, StrengthUnit> = {
  mg: "mg", mcg: "mcg", ug: "mcg", "\u03BCg": "mcg", iu: "IU", "%": "%",
};
const packageUnits = new Set(["\uC815", "\uCEA1\uC290", "\uD3EC", "\uB9E4", "\uAC1C\uC785", "\uC2A4\uD2F1", "\uD328\uCE58"]);
const physicalUnits = new Set(["\uAC1C", "\uBCD1", "\uCE94", "\uBD09", "\uD1B5", "\uD329"]);
const containerUnits = new Set(["\uBC15\uC2A4", "\uBB36\uC74C", "\uC138\uD2B8"]);

const sizeUnitPattern = "mL|ml|L|l|kg|g|\\uBC00\\uB9AC\\uB9AC\\uD130|\\uB9AC\\uD130|\\uD0AC\\uB85C\\uADF8\\uB7A8|\\uADF8\\uB7A8";
const tokenUnitPattern = `${sizeUnitPattern}|mg|mcg|ug|\\u03BCg|IU|iu|%|\\uC815|\\uCEA1\\uC290|\\uD3EC|\\uB9E4|\\uAC1C\\uC785|\\uC2A4\\uD2F1|\\uD328\\uCE58|\\uAC1C|\\uBCD1|\\uCE94|\\uBD09|\\uD1B5|\\uD329|\\uBC15\\uC2A4|\\uBB36\\uC74C|\\uC138\\uD2B8`;
const tokenPattern = new RegExp(`(\\d+(?:\\.\\d+)?)\\s*(${tokenUnitPattern})`, "giu");
// Keep this explicit instead of composing it from the broad token pattern:
// optional single-letter units (L/g) otherwise made `6~8kg` ambiguous.
const rangePattern = /(\d+(?:\.\d+)?)\s*(mL|ml|L|l|kg|g|\uBC00\uB9AC\uB9AC\uD130|\uB9AC\uD130|\uD0AC\uB85C\uADF8\uB7A8|\uADF8\uB7A8)?\s*(?:~|\u2013|-)\s*(\d+(?:\.\d+)?)\s*(mL|ml|L|l|kg|g|\uBC00\uB9AC\uB9AC\uD130|\uB9AC\uD130|\uD0AC\uB85C\uADF8\uB7A8|\uADF8\uB7A8)/giu;
const leadingListMarker = /^\s*\d{1,3}[.)]\s*/u;
const multiplicativeQuantity = /[x\u00d7]\s*(\d+)\s*(\uAC1C|\uBCD1|\uCE94|\uBD09|\uD1B5|\uD329)?/giu;

const lowerUnit = (value: string) => value.toLowerCase();
const tokenize = (text: string): NumericToken[] =>
  [...text.matchAll(tokenPattern)].map((match) => ({
    value: Number(match[1]),
    unit: match[2],
    start: match.index ?? 0,
  }));

const canonicalSize = (value: number, unit: SizeUnit) => {
  if (unit === "L") return { value: value * 1000, unit: "mL" as const };
  if (unit === "kg") return { value: value * 1000, unit: "g" as const };
  return { value, unit };
};

const sizeRangeToken = (text: string) => {
  // `rangePattern` is global because it is also used for replacement. Reset
  // the cursor so one parsed line can never affect the next list line.
  rangePattern.lastIndex = 0;
  const match = rangePattern.exec(text);
  rangePattern.lastIndex = 0;
  if (!match) return null;
  const firstUnit = match[2] ? sizeAliases[lowerUnit(match[2])] : undefined;
  const secondUnit = sizeAliases[lowerUnit(match[4])];
  if (!secondUnit) return null;
  // Preserve a natural unit for same-unit ranges (6~8kg stays kg); only
  // normalize when the two sides use different units (900g~1.2kg).
  const minimum = (firstUnit === undefined || firstUnit === secondUnit)
    ? { value: Number(match[1]), unit: firstUnit ?? secondUnit }
    : canonicalSize(Number(match[1]), firstUnit ?? secondUnit);
  const maximum = (firstUnit === undefined || firstUnit === secondUnit)
    ? { value: Number(match[3]), unit: secondUnit }
    : canonicalSize(Number(match[3]), secondUnit);
  if (minimum.unit !== maximum.unit || minimum.value > maximum.value) return null;
  return { start: match.index ?? 0, end: (match.index ?? 0) + match[0].length, minimum, maximum };
};

const cleanProductName = (text: string) => {
  const withoutRanges = text.replace(rangePattern, " ");
  const withoutComponents = withoutRanges.replace(/(?:^|\s|\+)\s*(\uBCF8\uD488|\uB9AC\uD544)\s*\d+\s*(\uAC1C|\uBCD1|\uD1B5|\uD329|\uC138\uD2B8)(?=\s|\+|$)/gu, " ");
  const withoutSizes = withoutComponents.replace(tokenPattern, " ");
  const withoutMultipliers = withoutSizes.replace(multiplicativeQuantity, " ");
  return withoutMultipliers
    .replace(/[,:/]/gu, " ")
    .replace(/[~\u2013\-\u00d7x]+/giu, " ")
    .replace(/\s+/gu, " ")
    .trim();
};

const componentMatches = (text: string) =>
  [...text.matchAll(/(?:^|\s|\+)\s*(\uBCF8\uD488|\uB9AC\uD544)\s*(\d+)\s*(\uAC1C|\uBCD1|\uD1B5|\uD329|\uC138\uD2B8)(?=\s|\+|$)/gu)];

/**
 * Separates a product's unit size, package content, requested physical units,
 * and requested purchase packages. List numbers and allowed size ranges are
 * deliberately removed from the product identity used for Coupang search.
 */
export function parseShoppingLine(rawText: string, index = 0): ShoppingRequestLine {
  const normalizedText = rawText.trim().replace(leadingListMarker, "").replace(/\s+/gu, " ");
  const tokens = tokenize(normalizedText);
  const range = sizeRangeToken(normalizedText);
  let unitSizeValue: number | null = range?.minimum.value ?? null;
  let unitSizeUnit: ShoppingRequestLine["unitSizeUnit"] = range?.minimum.unit ?? null;
  let strengthValue: number | null = null;
  let strengthUnit: ShoppingRequestLine["strengthUnit"] = null;
  let packageContentCount: number | null = null;
  let packageContentUnit: ShoppingRequestLine["packageContentUnit"] = null;
  let requestedPhysicalUnits: number | null = null;
  let requestedPurchaseUnits = 1;
  let hasExplicitContainer = false;

  for (const token of tokens) {
    const lower = lowerUnit(token.unit);
    const sizeUnit = sizeAliases[lower];
    const strengthUnitValue = strengthAliases[lower];
    if (sizeUnit) {
      if (unitSizeValue === null) {
        unitSizeValue = token.value;
        unitSizeUnit = sizeUnit;
      }
      continue;
    }
    if (strengthUnitValue) {
      strengthValue ??= token.value;
      strengthUnit ??= strengthUnitValue;
      continue;
    }
    if (packageUnits.has(token.unit)) {
      packageContentCount ??= token.value;
      packageContentUnit ??= token.unit as ShoppingRequestLine["packageContentUnit"];
      continue;
    }
    if (physicalUnits.has(token.unit)) {
      requestedPhysicalUnits ??= token.value;
      continue;
    }
    if (containerUnits.has(token.unit)) {
      requestedPurchaseUnits = token.value;
      hasExplicitContainer = true;
    }
  }

  const multiplied = [...normalizedText.matchAll(multiplicativeQuantity)][0];
  if (multiplied) requestedPhysicalUnits = Number(multiplied[1]);

  const components = componentMatches(normalizedText);
  const variantTokens = components.map((match) => `${match[1]} ${match[2]}${match[3]}`);
  if (components.length) requestedPhysicalUnits = components.reduce((sum, match) => sum + Number(match[2]), 0);
  if (!hasExplicitContainer && requestedPhysicalUnits !== null) requestedPurchaseUnits = requestedPhysicalUnits;
  if (range) variantTokens.push(`size-range:${range.minimum.value}-${range.maximum.value}:${range.minimum.unit}`);

  const productName = cleanProductName(normalizedText);
  const parseWarnings: string[] = [];
  if (!productName) parseWarnings.push("\uC0C1\uD488\uBA85\uC744 \uD655\uC778\uD574 \uC8FC\uC138\uC694.");
  if (range) parseWarnings.push(`\uC6A9\uB7C9 \uBC94\uC704 ${range.minimum.value}~${range.maximum.value}${range.minimum.unit}\uB85C \uAC80\uC0C9\uD569\uB2C8\uB2E4.`);

  return shoppingRequestLineSchema.parse({
    id: `line-${index + 1}`,
    rawText,
    normalizedText,
    brand: null,
    productName: productName || normalizedText,
    variantTokens,
    unitSizeValue,
    unitSizeUnit,
    strengthValue,
    strengthUnit,
    packageContentCount,
    packageContentUnit,
    requestedPhysicalUnits: requestedPhysicalUnits ?? requestedPurchaseUnits,
    requestedPurchaseUnits,
    parserConfidence: parseWarnings.some((warning) => warning.includes("\uC0C1\uD488\uBA85")) ? 0.7 : range ? 0.9 : 0.98,
    parseWarnings,
  });
}

export const parseShoppingList = (input: string) =>
  input.split(/\r?\n/u).map((line) => line.trim()).filter(Boolean).map(parseShoppingLine);

export const searchQueryForShoppingLine = (line: Pick<ShoppingRequestLine, "productName" | "unitSizeValue" | "unitSizeUnit">) => {
  const product = line.productName.trim();
  // Broad product families and range requests should return candidates for the
  // user to compare, rather than being over-constrained by an exact size token.
  return product || `${line.unitSizeValue ?? ""}${line.unitSizeUnit ?? ""}`.trim();
};
