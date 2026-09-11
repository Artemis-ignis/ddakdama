import { test, expect } from "./extension-fixture";

const origin = "https://ddakdama.artemis-clunk.workers.dev";
const planUrl = `${origin}/?plan=plan-import-test&grant=fixture-grant`;

test("배포 웹 origin의 원문 비저장 계획을 현재 수량과 규격 그대로 불러온다", async ({ context, page, extensionId }) => {
  const request = {
    id: "redacted-item", rawText: "입력 원문은 저장하지 않음", normalizedText: "스킨1004 히알루 시카 워터핏 선 세럼 50ml 2개",
    brand: "스킨1004", productName: "스킨1004 히알루 시카 워터핏 선 세럼", variantTokens: [],
    unitSizeValue: 50, unitSizeUnit: "mL", strengthValue: null, strengthUnit: null,
    packageContentCount: null, packageContentUnit: null, requestedPhysicalUnits: 4, requestedPurchaseUnits: 4,
    parserConfidence: 1, parseWarnings: [],
  };
  let fetched = false;
  await context.route(`${origin}/api/plans/plan-import-test`, route => {
    fetched = true;
    expect(route.request().headers().authorization).toBe("Bearer fixture-grant");
    return route.fulfill({ contentType: "application/json", json: { plan: { version: 1, items: [{ request, candidates: [], selectedCandidateId: null }] } } });
  });
  await page.goto(`chrome-extension://${extensionId}/dist/index.html`);
  const bridge = page.getByRole("region", { name: "딱담아 계획 바로 이어하기" });
  await bridge.getByRole("textbox", { name: "딱담아 계획 링크" }).fill(planUrl);
  await bridge.getByRole("button", { name: "불러오기", exact: true }).click();
  await expect(page.locator("#shopping-list")).toHaveValue("스킨1004 히알루 시카 워터핏 선 세럼 50mL 4개");
  expect(fetched).toBe(true);
  await expect(page.getByText("상품 1종 · 실물 4개", { exact: true })).toBeVisible();
});

test("현재 웹 origin에서도 기존 확장 연결 probe가 실제 서비스 워커까지 도달한다", async ({ context, page }) => {
  await context.route(`${origin}/`, route => route.fulfill({ contentType: "text/html", body: "<!doctype html><html><body>딱담아</body></html>" }));
  await page.goto(origin);
  const response = await page.evaluate(() => new Promise<{ supportsPlanImport: boolean }>((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("PROBE_TIMEOUT")), 5000);
    const listener = (event: MessageEvent) => {
      if (event.source !== window || event.data?.type !== "DDAKDAMA_EXTENSION_READY") return;
      clearTimeout(timeout); window.removeEventListener("message", listener); resolve(event.data);
    };
    window.addEventListener("message", listener);
    window.postMessage({ type: "DDAKDAMA_EXTENSION_PROBE" }, location.origin);
  }));
  expect(response.supportsPlanImport).toBe(true);
});

test("이미 열린 확장은 새 계획을 한 번 수신하고 기존 작업 목록은 덮어쓰지 않는다", async ({ context, page, extensionId, extensionWorker }) => {
  let reads = 0;
  await context.route(`${origin}/api/plans/plan-import-test`, route => {
    reads += 1;
    return route.fulfill({ contentType: "application/json", json: { plan: { version: 1, items: [{ request: { rawText: "클렌저 150ml 2개" }, candidates: [], selectedCandidateId: null }] } } });
  });
  await page.goto(`chrome-extension://${extensionId}/dist/index.html`);
  await expect(page.getByRole("heading", { name: "쇼핑 목록을 준비해 주세요" })).toBeVisible();
  await extensionWorker.evaluate(async link => chrome.storage.local.set({ "ddakdama-pending-plan-link": link }), planUrl);
  await expect(page.locator("#shopping-list")).toHaveValue("클렌저 150ml 2개");
  expect(reads).toBe(1);
  const nextLink = planUrl.replace("plan-import-test", "another-plan");
  await context.route(`${origin}/api/plans/another-plan`, route => route.fulfill({ contentType: "application/json", json: { plan: { version: 1, items: [{ request: { rawText: "샴푸 500g 1개" }, candidates: [], selectedCandidateId: null }] } } }));
  await extensionWorker.evaluate(async link => chrome.storage.local.set({ "ddakdama-pending-plan-link": link }), nextLink);
  await expect(page.getByRole("region", { name: "새 쇼핑 계획 수신" })).toBeVisible();
  await expect(page.locator("#shopping-list")).toHaveValue("클렌저 150ml 2개");
  await page.getByRole("button", { name: "새 계획 불러오기" }).click();
  await expect(page.locator("#shopping-list")).toHaveValue("샴푸 500g 1개");
  await expect(page.getByRole("region", { name: "새 쇼핑 계획 수신" })).toHaveCount(0);
});
