import { describe, expect, it } from "vitest";
import { searchQueriesFromRawText, searchQueryPlanFromRawText } from "../src/search-query.js";

describe("search query recovery", () => {
  it("keeps product identity when a range and pack count are present", () => {
    expect(searchQueriesFromRawText("\uC81C\uB85C \uC544\uC774\uC2A4\uD06C\uB9BC \uBC14 70~100ml \u00D7 10\uAC1C, 1\uC138\uD2B8"))
      .toEqual(["\uC81C\uB85C \uC544\uC774\uC2A4\uD06C\uB9BC \uBC14 70~100ml \u00D7 10\uAC1C, 1\uC138\uD2B8", "\uC81C\uB85C \uC544\uC774\uC2A4\uD06C\uB9BC \uBC14", "\uC544\uC774\uC2A4\uD06C\uB9BC \uBC14"]);
  });

  it("uses either side of a preference as a recoverable search query", () => {
    expect(searchQueriesFromRawText("\uCEF5 \uACFC\uC77C \uB610\uB294 \uACFC\uC77C\uCEF5 100~150g \u00D7 6\uAC1C, 1\uC138\uD2B8"))
      .toEqual(["\uCEF5 \uACFC\uC77C \uB610\uB294 \uACFC\uC77C\uCEF5 100~150g \u00D7 6\uAC1C, 1\uC138\uD2B8", "\uCEF5 \uACFC\uC77C \uB610\uB294 \uACFC\uC77C\uCEF5", "\uACFC\uC77C\uCEF5"]);
  });

  it("keeps a named product in every fallback and never searches a size token alone", () => {
    const plan = searchQueryPlanFromRawText("\uBE59\uADF8\uB808 \uBA54\uB85C\uB098 \uBA5C\uB860 75ml \u00D7 10\uAC1C, 1\uC138\uD2B8");
    expect(plan.map((entry) => entry.stage)).toEqual(["ORIGINAL", "BRAND_AND_PRODUCT", "CORE_PRODUCT"]);
    expect(plan.map((entry) => entry.query)).toEqual([
      "\uBE59\uADF8\uB808 \uBA54\uB85C\uB098 \uBA5C\uB860 75ml \u00D7 10\uAC1C, 1\uC138\uD2B8",
      "\uBE59\uADF8\uB808 \uBA54\uB85C\uB098 \uBA5C\uB860",
      "\uBA54\uB85C\uB098 \uBA5C\uB860",
    ]);
    expect(plan.some((entry) => /^75m[lL]$/u.test(entry.query))).toBe(false);
  });
});
