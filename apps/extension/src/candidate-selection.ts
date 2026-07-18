import { titleContainsProductIdentity, type ShoppingRequestLine } from "@ddakdama/core";

export type CandidateForSelection = {
  title: string;
  currentPrice: number | null;
  unitsPerPackage: number;
  rocketDelivery: boolean;
  advertised: boolean;
};

const normalize = (value: string) => value.toLowerCase().replace(/[^0-9a-z가-힣]/gu, "");

const containsSpec = (title: string, value: number | null, unit: string | null) =>
  !value || !unit || normalize(title).includes(normalize(`${value}${unit}`));

const rangeFor = (line: ShoppingRequestLine) => {
  const token = line.variantTokens.find((value) => value.startsWith("size-range:"));
  const match = token?.match(/^size-range:(\d+(?:\.\d+)?)-(\d+(?:\.\d+)?):(mL|L|g|kg)$/u);
  return match ? { minimum: Number(match[1]), maximum: Number(match[2]), unit: match[3] } : null;
};

const candidateSizeInsideRange = (title: string, range: NonNullable<ReturnType<typeof rangeFor>>) => {
  const pattern = /(\d+(?:\.\d+)?)\s*(mL|ml|L|l|g|kg)/gu;
  for (const match of title.matchAll(pattern)) {
    let value = Number(match[1]);
    let unit = match[2].toLowerCase();
    if (range.unit === "mL" && unit === "l") { value *= 1000; unit = "ml"; }
    if (range.unit === "g" && unit === "kg") { value *= 1000; unit = "g"; }
    const comparableUnit = range.unit.toLowerCase();
    if ((unit === comparableUnit || (unit === "ml" && comparableUnit === "ml")) && value >= range.minimum && value <= range.maximum) return true;
  }
  return false;
};

export function candidateMatchesRequest(
  line: ShoppingRequestLine,
  candidate: CandidateForSelection,
): boolean {
  if (!Number.isInteger(candidate.unitsPerPackage) || candidate.unitsPerPackage <= 0) return false;
  if (line.requestedPhysicalUnits % candidate.unitsPerPackage !== 0) return false;
  if (!titleContainsProductIdentity(candidate.title, line.brand, line.productName)) return false;
  const range = rangeFor(line);
  if (range ? !candidateSizeInsideRange(candidate.title, range) : !containsSpec(candidate.title, line.unitSizeValue, line.unitSizeUnit)) return false;
  if (!containsSpec(candidate.title, line.strengthValue, line.strengthUnit)) return false;
  if (!containsSpec(candidate.title, line.packageContentCount, line.packageContentUnit)) return false;
  return true;
}

export function candidateScore(
  line: ShoppingRequestLine,
  candidate: CandidateForSelection,
): number {
  if (!candidateMatchesRequest(line, candidate)) return Number.NEGATIVE_INFINITY;
  let score = 100;
  if (candidate.currentPrice && candidate.currentPrice > 0) score += 2;
  if (candidate.rocketDelivery) score += 4;
  if (candidate.advertised) score -= 5;
  return score;
}

export function selectBestCandidate<T extends CandidateForSelection>(
  line: ShoppingRequestLine,
  results: T[],
): T | null {
  return [...results]
    .filter((candidate) => candidateMatchesRequest(line, candidate))
    .sort((a, b) => {
      const scoreGap = candidateScore(line, b) - candidateScore(line, a);
      if (scoreGap !== 0) return scoreGap;
      const aSubtotal = (a.currentPrice ?? Infinity) * (line.requestedPhysicalUnits / a.unitsPerPackage);
      const bSubtotal = (b.currentPrice ?? Infinity) * (line.requestedPhysicalUnits / b.unitsPerPackage);
      return aSubtotal - bSubtotal;
    })[0] ?? null;
}
