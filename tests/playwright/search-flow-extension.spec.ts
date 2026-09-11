import { test, expect } from "./extension-fixture";

const origin = "http://127.0.0.1:4174";
const requests = [
  "닥터지 레드 블레미쉬 포 맨 진정 올인원 150ml",
  "스킨1004 히알루 시카 워터핏 선 세럼 50ml 2개",
  "라운드랩 1025 독도 클렌저 150ml 2개",
  "TS 골드플러스 샴푸 500g",
  "닥터스베스트 고흡수 마그네슘 100mg 240정",
];
const products = requests.map((title, i) => ({
  query: title.split(" ")[0], title, productId: String(760000 + i),
  vendorItemId: String(860000 + i), itemId: String(960000 + i), price: 16700 + i * 100,
}));
const items = requests.map((rawText, i) => ({ id: `sample-${i}`, rawText }));
async function configure(searchOptions: Record<string, unknown> = {}) {
  const result = await fetch(`${origin}/fixture/configure`, {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ products, searchOptions: { requireForm: true, includeSearchPrices: true, ...searchOptions } }),
  });
  expect(result.ok).toBe(true);
}
const state = () => fetch(`${origin}/fixture/state`).then(response => response.json());

test("API 없이 사이트 검색창으로 5종을 검색하고 늦은 이동의 이전 상품을 섞지 않는다", async ({ page, extensionId }) => {
  await configure({ navigationDelayMs: 600, cardsDelayMs: 900 });
  await page.goto(`chrome-extension://${extensionId}/dist/index.html`);
  const response = await page.evaluate(items => chrome.runtime.sendMessage({ type: "DDAKDAMA_SEARCH_ALL", items }), items);
  expect(response.ok).toBe(true);
  expect(response.output).toHaveLength(5);
  for (const [i, group] of response.output.entries()) {
    expect(group.error).toBeUndefined();
    expect(group.results).toHaveLength(1);
    expect(group.results[0]).toMatchObject({ productId: products[i].productId, currentPrice: products[i].price, source: "BROWSER" });
  }
  expect((await state()).searchRequests).toEqual(requests.map(query => ({ query, channel: "SHOP_FORM" })));
});

test("이미지로 된 접근 제한은 1회에서 멈추고 남은 4종을 검색 결과 없음으로 덮지 않는다", async ({ page, extensionId, context }) => {
  await configure({ blocked: true });
  const userTab = await context.newPage();
  await userTab.goto(`${origin}/`);
  await page.goto(`chrome-extension://${extensionId}/dist/index.html`);
  const response = await page.evaluate(items => chrome.runtime.sendMessage({ type: "DDAKDAMA_SEARCH_ALL", items }), items);
  expect(response.output.map((group: { error: string }) => group.error)).toEqual(Array(5).fill("SECURITY_CHECK_REQUIRED"));
  expect(response.output.slice(1).every((group: { paused: boolean }) => group.paused)).toBe(true);
  expect((await state()).searchRequests).toHaveLength(1);
  expect(response.recoveryTabId).toEqual(expect.any(Number));
  expect(userTab.isClosed()).toBe(false);
  await expect(userTab).toHaveURL(`${origin}/`);

  // Simulate the user successfully returning home and searching normally.
  // This is a fixture recovery, not an attempt to bypass a live access block.
  const recovery = context.pages().find(tab => tab.url().includes("/search?"));
  expect(recovery).toBeTruthy();
  await configure();
  await recovery!.goto(`${origin}/`);
  await recovery!.getByRole("textbox", { name: "쿠팡 상품 검색" }).fill(requests[0]);
  await recovery!.getByRole("button", { name: "검색", exact: true }).click();
  await expect(recovery!.locator('[class*="ProductUnit_productName"]')).toHaveText(requests[0]);
  const resumed = await page.evaluate(items => chrome.runtime.sendMessage({ type: "DDAKDAMA_SEARCH_ALL", items }), items);
  expect(resumed.output.every((group: { results: unknown[] }) => group.results.length === 1)).toBe(true);
  expect((await state()).searchRequests.map((row: { query: string }) => row.query)).toEqual(requests);
  expect(recovery!.isClosed()).toBe(true);
  expect(userTab.isClosed()).toBe(false);
});

test("정상 화면의 리뷰 수 403은 접근 제한이 아니고 명시적인 HTTP 오류는 중단한다", async ({ page, extensionWorker }) => {
  await configure();
  await page.goto(`${origin}/`);
  await page.evaluate(() => {
    document.title = "쿠팡 상품 검색";
    const reviews = document.createElement("p");
    reviews.textContent = "구매 후기 403 개";
    document.body.prepend(reviews);
  });
  const inspect = () => extensionWorker.evaluate(async () => {
    const tabs = await chrome.tabs.query({ url: "http://127.0.0.1:4174/*" });
    return chrome.tabs.sendMessage(tabs[0].id!, { type: "DDAKDAMA_SEARCH_RESULTS" });
  });
  expect((await inspect()).securityRequired).toBe(false);
  await page.evaluate(() => { document.title = "403 Forbidden"; });
  expect((await inspect()).securityRequired).toBe(true);
  await page.evaluate(() => { document.title = "403"; });
  expect((await inspect()).securityRequired).toBe(true);
  expect((await state()).searchRequests).toHaveLength(0);
});

test("이전 버전 DOM 표시가 남아도 재주입되고 중복 listener가 검색을 두 번 보내지 않는다", async ({ page, extensionWorker }) => {
  await configure();
  await page.goto(`${origin}/`);
  expect(await page.evaluate(() => document.documentElement.dataset.ddakdamaContentReady)).toBe("1");
  const result = await extensionWorker.evaluate(async query => {
    const tabs = await chrome.tabs.query({ url: "http://127.0.0.1:4174/*" });
    const tabId = tabs[0].id!;
    await chrome.scripting.executeScript({ target: { tabId }, files: ["dist/content.js"] });
    await chrome.scripting.executeScript({ target: { tabId }, files: ["dist/content.js"] });
    const ping = await chrome.tabs.sendMessage(tabId, { type: "DDAKDAMA_PING_CONTENT" });
    const submitted = await chrome.tabs.sendMessage(tabId, { type: "DDAKDAMA_SUBMIT_SEARCH", query });
    return { ping, submitted };
  }, requests[0]);
  expect(result.ping.ok).toBe(true);
  expect(result.submitted.ok).toBe(true);
  await expect(page.locator('[class*="ProductUnit_productName"]')).toHaveText(requests[0]);
  expect((await state()).searchRequests).toHaveLength(1);
});

for (const width of [360, 420]) {
  test(`${width}px 오류 화면에서도 상품명과 규격을 읽을 수 있다`, async ({ page, extensionId }) => {
    await configure({ blocked: true });
    await page.setViewportSize({ width, height: 1000 });
    await page.goto(`chrome-extension://${extensionId}/dist/index.html`);
    await page.getByRole("button", { name: "예시 불러오기" }).click();
    await page.getByRole("button", { name: "실제 상품 찾기" }).click();
    const first = page.getByTestId("product-0");
    await expect(first.locator(".product-row-price")).toHaveText("쿠팡 접근 제한");
    const title = first.locator(".product-row-copy strong");
    await expect(title).toContainText("닥터지");
    expect((await title.boundingBox())!.width).toBeGreaterThan(100);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await expect(page.locator("#shopping-list")).toHaveCount(0);
  });
}
