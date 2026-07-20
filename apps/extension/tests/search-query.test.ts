import { describe, expect, it } from "vitest";
import { searchQueriesFromRawText } from "../src/search-query.js";

describe("search query recovery", () => {
  it("keeps product identity when a range and pack count are present", () => {
    expect(searchQueriesFromRawText("\uC81C\uB85C \uC544\uC774\uC2A4\uD06C\uB9BC \uBC14 70~100ml \u00D7 10\uAC1C, 1\uC138\uD2B8"))
      .toEqual(["\uC81C\uB85C \uC544\uC774\uC2A4\uD06C\uB9BC \uBC14"]);
  });

  it("uses either side of a preference as a recoverable search query", () => {
    expect(searchQueriesFromRawText("\uCEF5 \uACFC\uC77C \uB610\uB294 \uACFC\uC77C\uCEF5 100~150g \u00D7 6\uAC1C, 1\uC138\uD2B8"))
      .toEqual(["\uCEF5 \uACFC\uC77C \uB610\uB294 \uACFC\uC77C\uCEF5", "\uCEF5 \uACFC\uC77C", "\uACFC\uC77C\uCEF5"]);
  });
});
