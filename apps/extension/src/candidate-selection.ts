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

export function candidateMatchesRequest(
  line: ShoppingRequestLine,
  candidate: CandidateForSelection,
): boolean {
  if (!Number.isInteger(candidate.unitsPerPackage) || candidate.unitsPerPackage <= 0) return false;
  if (line.requestedPhysicalUnits % candidate.unitsPerPackage !== 0) return false;
  if (!titleContainsProductIdentity(candidate.title, line.brand, line.productName)) return false;
  if (!containsSpec(candidate.title, line.unitSizeValue, line.unitSizeUnit)) return false;
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
