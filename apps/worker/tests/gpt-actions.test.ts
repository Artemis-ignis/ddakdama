import { describe, expect, it } from "vitest";
import {
  gptActionsOpenApi,
  normalizeGptPlanInput,
} from "../src/gpt-actions.js";

describe("GPT beta action contract", () => {
  it("exposes only short-lived plan-link operations", () => {
    const document = gptActionsOpenApi("https://ddakdama.artemis-clunk.workers.dev") as {
      openapi: string;
      servers: Array<{ url: string }>;
      paths: Record<string, unknown>;
    };
    expect(document.openapi).toBe("3.1.0");
    expect(document.servers).toEqual([{ url: "https://ddakdama.artemis-clunk.workers.dev" }]);
    expect(Object.keys(document.paths)).toEqual([
      "/api/gpt/plans",
      "/api/gpt/plans/replace",
      "/api/gpt/plans/handoff",
    ]);
    expect(Object.keys(document.paths)).not.toContain("/api/affiliate/deeplink");
    expect(Object.keys(document.paths)).not.toContain("/api/executions");
  });

  it("keeps every GPT Action operation description within the Builder limit", () => {
    const document = gptActionsOpenApi("https://ddakdama.artemis-clunk.workers.dev") as {
      paths: Record<string, Record<string, { description?: string }>>;
    };

    for (const pathItem of Object.values(document.paths)) {
      for (const operation of Object.values(pathItem)) {
        if (operation.description) {
          expect(operation.description.length).toBeLessThanOrEqual(300);
        }
      }
    }
  });

  it("keeps goal, budget and fallback rules out of Coupang product rows", () => {
    const normalized = normalizeGptPlanInput({
      shoppingList: [
        "오늘 먹을 반찬거리",
        "총예산 10 000원 이내 목표",
        "두부 1모",
        "콩나물 1봉",
        "애호박 1개",
        "계란 6구 1팩",
        "대파 1단 또는 소포장 1개",
        "예산 초과 시 대체 우선순위: 대파 제외 → 애호박 제외",
      ].join("\n"),
    });

    expect(normalized.shoppingList.split("\n")).toEqual([
      "두부 1모",
      "콩나물 1봉",
      "애호박 1개",
      "계란 6구 1팩",
      "대파 1단 또는 소포장 1개",
    ]);
    expect(normalized.context).toEqual({
      goal: "오늘 먹을 반찬거리",
      budgetWon: 10_000,
      notes: ["예산 초과 시 대체 우선순위: 대파 제외 → 애호박 제외"],
    });
    expect(normalized.ignoredEntries).toHaveLength(3);
  });

  it("builds one list row per structured concrete item", () => {
    const normalized = normalizeGptPlanInput({
      items: [
        { productName: "두부", quantity: "1모" },
        { productName: "계란", specification: "6구", quantity: "1팩" },
      ],
      context: { goal: "오늘 먹을 반찬", budgetWon: 10_000 },
    });

    expect(normalized.shoppingList).toBe("두부 1모\n계란 6구 1팩");
    expect(normalized.ignoredEntries).toEqual([]);
  });

  it("publishes a structured item schema instead of a free-form shopping list", () => {
    const document = gptActionsOpenApi("https://ddakdama.artemis-clunk.workers.dev") as {
      paths: Record<string, unknown>;
    };
    const operation = JSON.stringify(document.paths["/api/gpt/plans"]);
    expect(operation).toContain('"required":["items"]');
    expect(operation).toContain("구체적인 상품명");
    expect(operation).not.toContain('"shoppingList"');
  });
});
