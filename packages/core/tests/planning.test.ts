import { describe, expect, it } from "vitest";
import { createCartExecution, createCartPlan, finalizePlanStatus, productCandidateSchema } from "../src/planning.js";
import { answerClarification } from "../src/clarification.js";

const candidate = productCandidateSchema.parse({
  id: "1-2", productId: "1", vendorItemId: "2", itemId: null, title: "생수 1L 12병", currentPrice: 8000,
  unitsPerPackage: 12, imageUrl: null, seller: null, fulfillmentType: "ROCKET", deliveryPromise: null,
  shippingFee: null, freeShippingThreshold: null, deliveryCertainty: "UNKNOWN", stockStatus: "IN_STOCK",
  requiredOption: false, source: "FIXTURE", canonicalUrl: "https://www.coupang.com/vp/products/1",
  partnersSearchUrl: null, affiliateUrl: "https://link.coupang.com/a/test", affiliateVerified: true,
  affiliateResolvedAt: 1, affiliateSubId: "fixture",
});

describe("cart plan and execution contracts", () => {
  it("keeps the affiliate URL distinct from the canonical product URL", () => {
    expect(candidate.canonicalUrl).not.toBe(candidate.affiliateUrl);
    expect(candidate.affiliateVerified).toBe(true);
  });

  it("makes an immutable execution snapshot from the selected plan version", () => {
    const plan = createCartPlan("생수 1L 12병", "00000000-0000-4000-8000-000000000001", 100);
    const selected = { ...plan, status: "READY" as const, items: [{ ...plan.items[0]!, candidates: [candidate], selectedCandidateId: candidate.id }] };
    expect(finalizePlanStatus(selected)).toBe("READY");
    const execution = createCartExecution(selected, "00000000-0000-4000-8000-000000000002", 200);
    expect(execution.planVersion).toBe(1);
    expect(execution.items[0]!.candidate.affiliateUrl).toBe(candidate.affiliateUrl);
  });

  it("stores shopping purpose and budget separately from product rows", () => {
    const plan = createCartPlan(
      "두부 1모\n콩나물 1봉",
      "00000000-0000-4000-8000-000000000003",
      300,
      { goal: "오늘 먹을 반찬거리", budgetWon: 10_000, notes: ["대파는 예산 초과 시 제외"] },
    );
    expect(plan.items.map((item) => item.request.productName)).toEqual(["두부", "콩나물"]);
    expect(plan.context?.budgetWon).toBe(10_000);
    expect(plan.items.some((item) => item.request.productName.includes("예산"))).toBe(false);
  });

  it("pauses ambiguous meat inputs before product discovery and preserves the answer", () => {
    const plan = createCartPlan("소고기", "00000000-0000-4000-8000-000000000004", 400);
    const item = plan.items[0]!;
    expect(item.clarification?.status).toBe("REQUIRED");
    expect(item.clarification?.options.map((option) => option.label)).toContain("구이용");
    const answered = answerClarification(item.request, item.clarification!, "구이용");
    expect(answered.clarification.status).toBe("ANSWERED");
    expect(answered.request.productName).toContain("구이용");
  });

  it("does not create an execution while clarification is still required", () => {
    const plan = createCartPlan("소고기", "00000000-0000-4000-8000-000000000005", 500);
    expect(() => createCartExecution(plan)).toThrow("CLARIFICATION_REQUIRED");
  });
});
