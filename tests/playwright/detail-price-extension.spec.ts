import { test, expect } from "./extension-fixture";

const url = "https://www.coupang.com/vp/products/8660511597?itemId=28252913485&vendorItemId=95206271069";
const title = "닥터지 레드 블레미쉬 포 맨 진정 올인원, 150ml, 2개";
// Minimal reproduction of the live 2026-09-10 purchase DOM. These prices are
// fixture expectations, not a live quote or evidence that cart execution passed.
const normalPrice = `<div class="twc-text-bluegray-900">일반판매가</div><div><div><div class="twc-font-bold"><span>32,930</span>원</div><div>(10ml당 1,098원)</div></div></div>`;
const wowPrice = `<div><div>와우할인가</div><div class="twc-line-through">32,930원</div><div><span>31,280</span>원</div><div>(10ml당 1,043원)</div><div>할인받기</div></div>`;
const pageHtml = (price: string) => `<!doctype html><html><head><meta charset="utf-8"></head><body><div class="prod-atf"><h1>${title}</h1><div class="price-container price-container-v2"><div class="price-layout-container">${price}</div></div><div class="option-picker-container"><div>1개 16,700원</div><div>2개 32,930원</div><div>5개 80,020원</div></div><button class="prod-cart-btn">장바구니 담기</button><button>바로구매</button></div><section class="related-products"><div class="price-container"><div>999원</div></div></section></body></html>`;

for (const scenario of [
  { name: "고춧가루 시간 할인액과 실제 판매가 분리", html: '<div class="price-layout-container price-layout-normal"><div><div>14%</div><div>7,650원</div><div>(100g당 1,530원)</div><div class="twc-line-through">8,950원</div></div><div><div><div>300원</div><div>할인</div><div>17시간 남음</div><div class="twc-line-through">7,950원</div></div></div></div>', expected: 7650 },
  { name: "와우 가입 할인 대신 일반판매가", html: `${wowPrice}<div>${normalPrice}</div>`, expected: 32930 },
  { name: "취소선 정가 대신 현재 단일 판매가", html: '<div class="twc-line-through">40,000원</div><div><span>32,930</span>원</div><div>(10ml당 1,098원)</div>', expected: 32930 },
  { name: "정가와 빈 툴팁을 감싼 부모에서 취소선 가격을 다시 읽지 않음", html: '<div>26%</div><div>32,930원</div><div>(1정당 137원)</div><div class="twc-flex"><div class="twc-line-through">60,000원</div><div class="price-policies"><span aria-haspopup="dialog"><svg></svg></span></div></div>', expected: 32930 },
  { name: "가입·쿠폰 수령 조건만 있는 가격은 확인 불가", html: wowPrice, expected: null },
  { name: "상추 상품가와 같은 영역의 배송비를 분리", html: '<div class="price-layout-container"><div>2,100원</div><div>(100g당 1,050원)</div></div><div class="price-shipping-fee-info-container"><div>배송비</div><div>3,500원</div></div><div class="price-shipping-fee-conditional-msg">같은 판매자 상품 50,000원 이상 구매 시 무료배송</div>', expected: 2100 },
]) {
  test(`현행 상세 DOM: ${scenario.name}`, async ({ context, page, extensionWorker, extensionId }) => {
    await context.route("https://www.coupang.com/vp/products/8660511597**", route => route.fulfill({ contentType: "text/html; charset=utf-8", body: pageHtml(scenario.html) }));
    await page.goto(url);
    const detail = await extensionWorker.evaluate(async () => {
      const tabs = await chrome.tabs.query({ url: "https://www.coupang.com/vp/products/8660511597*" });
      return chrome.tabs.sendMessage(tabs[0].id!, { type: "DDAKDAMA_INSPECT_PRODUCT" });
    });
    expect(detail).toMatchObject({ price: scenario.expected, title, unitsPerPackage: 2, inStock: true });
    expect(detail.price).not.toBe(999);
    if (scenario.expected !== null) {
      await page.goto(`chrome-extension://${extensionId}/dist/index.html`);
      const result = await page.evaluate(({ url, title }) => chrome.runtime.sendMessage({ type: "DDAKDAMA_PREFLIGHT", jobs: [{
        id: "live-shape", productUrl: url, productId: "8660511597", itemId: "28252913485", vendorItemId: "95206271069",
        expectedProductName: title, expectedBrand: "닥터지", expectedUnitsPerPackage: 2,
        expectedUnitSize: "150ml", expectedStrength: null, expectedPackageContent: null, cartPurchaseQuantity: 1, status: "QUEUED",
      }] }), { url, title });
      expect(result.results[0]).toMatchObject({ status: "READY", verifiedPrice: scenario.expected });
    }
  });
}

test("상세 정보가 준비되면 느린 광고 이미지의 load 완료를 기다리지 않는다", async ({ context, page, extensionId }, testInfo) => {
  let releaseImage = () => {};
  const imageReleased = new Promise<void>(resolve => { releaseImage = resolve; });
  await context.route("https://www.coupang.com/qa-slow-image", async route => {
    await imageReleased;
    await route.fulfill({ status: 204 }).catch(() => {});
  });
  await context.route("https://www.coupang.com/vp/products/8660511597**", route => route.fulfill({ contentType: "text/html; charset=utf-8", body: pageHtml(normalPrice).replace("</body>", '<img src="/qa-slow-image"></body>') }));
  await page.goto(`chrome-extension://${extensionId}/dist/index.html`);
  try {
    const started = Date.now();
    const response = await page.evaluate(({ url, title }) => chrome.runtime.sendMessage({ type: "DDAKDAMA_PREFLIGHT", jobs: [{
      id: "slow-ad", productUrl: url, productId: "8660511597", itemId: "28252913485", vendorItemId: "95206271069",
      expectedProductName: title, expectedBrand: "닥터지", expectedUnitsPerPackage: 2,
      expectedUnitSize: "150ml", expectedStrength: null, expectedPackageContent: null, cartPurchaseQuantity: 1, status: "QUEUED",
    }] }), { url, title });
    const elapsedMs = Date.now() - started;
    await testInfo.attach("dom-ready-timing", { body: JSON.stringify({ elapsedMs, fixture: true }), contentType: "application/json" });
    expect(response.results[0]).toMatchObject({ status: "READY", verifiedPrice: 32930 });
    expect(elapsedMs).toBeLessThan(5000);
  } finally { releaseImage(); }
});

test("5종 상세 검증의 불필요한 페이지 idle 대기 시간을 측정한다", async ({ context, page, extensionId }, testInfo) => {
  let release = () => {};
  const pending = new Promise<void>(resolve => { release = resolve; });
  await context.route("https://www.coupang.com/qa-preflight-ad**", async route => {
    await pending;
    await route.fulfill({ status: 204 }).catch(() => {});
  });
  await context.route("https://www.coupang.com/vp/products/8660511597**", route => route.fulfill({
    contentType: "text/html; charset=utf-8",
    body: pageHtml(normalPrice).replace("</body>", '<img src="/qa-preflight-ad"></body>'),
  }));
  await page.goto(`chrome-extension://${extensionId}/dist/index.html`);
  try {
    const started = Date.now();
    const response = await page.evaluate(({ url, title }) => chrome.runtime.sendMessage({
      type: "DDAKDAMA_PREFLIGHT",
      jobs: Array.from({ length: 5 }, (_, index) => ({
        id: `timing-${index}`, productUrl: `${url}&qa=${index}`, productId: "8660511597",
        itemId: "28252913485", vendorItemId: "95206271069", expectedProductName: title,
        expectedBrand: "닥터지", expectedUnitsPerPackage: 2, expectedUnitSize: "150ml",
        expectedStrength: null, expectedPackageContent: null, cartPurchaseQuantity: 1, status: "QUEUED",
      })),
    }), { url, title });
    const elapsedMs = Date.now() - started;
    console.log(`PREFLIGHT_FIVE_FIXTURE_MS=${elapsedMs}`);
    await testInfo.attach("five-product-timing", { body: JSON.stringify({ elapsedMs, fixture: true }), contentType: "application/json" });
    expect(response.results).toHaveLength(5);
    expect(response.results.every((result: { status: string; verifiedPrice: number }) => result.status === "READY" && result.verifiedPrice === 32930)).toBe(true);
  } finally { release(); }
});

test("와우 신청 버튼이 있는 식품 6종은 품절로 오인하거나 항목마다 재시도하지 않는다", async ({ context, page, extensionId }, testInfo) => {
  test.setTimeout(90000);
  const names = ["곰곰 만능두부, 300g, 1개", "가농 금계란, 10구, 1개", "흙대파, 1kg, 1개", "국내산 양파, 1kg, 1개", "애호박, 1개입, 1개", "곰곰 GAP 콩나물, 300g, 1개"];
  await context.route("https://www.coupang.com/vp/products/8660511597**", route => {
    const index = Number(new URL(route.request().url()).searchParams.get("qa") ?? 0);
    return route.fulfill({ contentType: "text/html; charset=utf-8", body: `<!doctype html><html><body><div class="prod-atf"><h1>${names[index]}</h1><div class="price-container"><div>990원</div></div><div class="button-box"><button disabled>수량더하기</button><button class="prod-loyalty-register-btn"><span>로켓와우 신청하기</span></button></div></div></body></html>` });
  });
  await page.goto(`chrome-extension://${extensionId}/dist/index.html`);
  const started = Date.now();
  const response = await page.evaluate(({ url, names }) => chrome.runtime.sendMessage({
    type: "DDAKDAMA_PREFLIGHT", jobs: names.map((name, index) => ({
      id: `food-${index}`, productUrl: `${url}&qa=${index}`, productId: "8660511597", itemId: "28252913485", vendorItemId: "95206271069",
      expectedProductName: name, expectedBrand: null, expectedUnitsPerPackage: 1, expectedUnitSize: null,
      expectedStrength: null, expectedPackageContent: null, cartPurchaseQuantity: 1, status: "QUEUED",
    })),
  }), { url, names });
  const elapsedMs = Date.now() - started;
  console.log(`MEMBERSHIP_SIX_FIXTURE_MS=${elapsedMs}`);
  await testInfo.attach("membership-food-timing", { body: JSON.stringify({ elapsedMs, statuses: response.results.map((r: { status: string }) => r.status), fixture: true }), contentType: "application/json" });
  expect(response.results.map((r: { status: string }) => r.status)).toEqual(names.map(() => "MEMBERSHIP_REQUIRED"));
  expect(elapsedMs).toBeLessThan(6000);
});
