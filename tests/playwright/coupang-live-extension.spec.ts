import { test, expect } from "./extension-fixture";

// Opt-in, isolated Chromium profile. No routes, fixture responses, copied
// cookies, user profile, stealth flags, checkout or payment actions.
test("실제 쿠팡: 운영 확장의 예시 5종 검색과 담기 전 확인", async ({ context, page, extensionId }, testInfo) => {
  test.skip(process.env.DDAKDAMA_LIVE_COUPANG !== "1", "실제 쿠팡을 호출하는 명시적 실연결 검사");
  test.setTimeout(180_000);
  const started = Date.now();
  const marks: Record<string, number> = {};
  await page.goto(`chrome-extension://${extensionId}/dist/index.html`);
  await page.getByRole("button", { name: "예시 불러오기" }).click();
  await page.getByRole("button", { name: "실제 상품 찾기" }).click();
  await expect(page.getByTestId("product-0")).toBeVisible({ timeout: 120_000 });
  marks.searchMs = Date.now() - started;
  await testInfo.attach("actual-search-screen", { body: await page.screenshot({ fullPage: true }), contentType: "image/png" });
  const searchText = await page.locator("body").innerText();
  if (/쿠팡 접근 제한|검색 확인 필요|로그인 필요/u.test(searchText)) {
    await testInfo.attach("live-block", { body: JSON.stringify({ marks, ui: searchText, tabs: context.pages().map(tab => tab.url()) }, null, 2), contentType: "application/json" });
    throw new Error("LIVE_COUPANG_BLOCKED: no retry or security bypass attempted");
  }
  await expect(page.getByText("5/5종 선택", { exact: true })).toBeVisible();
  const beforePreflight = Date.now();
  await page.getByRole("button", { name: "5종 상세 확인하기", exact: true }).click();
  await expect(page.getByRole("heading", { name: "담기 전 확인", exact: true })).toBeVisible({ timeout: 60_000 });
  marks.preflightMs = Date.now() - beforePreflight;
  await testInfo.attach("actual-preflight-screen", { body: await page.screenshot({ fullPage: true }), contentType: "image/png" });
  await testInfo.attach("actual-preflight-result", { body: JSON.stringify({ marks, ui: await page.locator("body").innerText() }, null, 2), contentType: "application/json" });
  await expect(page.getByRole("button", { name: "5종 장바구니에 담기", exact: true })).toBeEnabled();
  // Intentionally stop before changing a real cart. Authenticated cart testing
  // requires an explicitly chosen test account and stays outside checkout.
});
