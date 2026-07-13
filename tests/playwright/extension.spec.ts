import{test,expect}from"./extension-fixture";

test("Manifest V3 서비스 워커와 Side Panel이 실제 Chromium에서 동작한다",async({page,extensionId,extensionWorker})=>{
 expect(extensionWorker.url()).toContain(`chrome-extension://${extensionId}/dist/background.js`);
 await page.goto(`chrome-extension://${extensionId}/dist/index.html`);
 await expect(page.getByRole("heading",{name:"상품 5종 · 실물 7개"})).toBeVisible();
 await expect(page.getByRole("button",{name:"장바구니에 정확히 담기"})).toBeDisabled();
 await expect(page.getByText("GPT 앱과 이어서 담기")).toBeVisible();
 await expect(page.getByText("MCP URL")).toHaveCount(0);
 const ping=await page.evaluate(()=>chrome.runtime.sendMessage({type:"DDAKDAMA_PING"}));
 expect(ping).toEqual({ok:true,name:"ddakdama",version:"1.0.0"});
 await page.evaluate(async()=>{await chrome.storage.local.set({"playwright-storage-check":"ok"})});
 expect(await page.evaluate(async()=>(await chrome.storage.local.get("playwright-storage-check"))["playwright-storage-check"])).toBe("ok");
});

test("쿠팡 URL에 content script가 주입되어 후보를 구조화한다",async({context,page,extensionWorker})=>{
 await context.route("https://www.coupang.com/np/search**",route=>route.fulfill({status:200,headers:{"content-type":"text/html; charset=utf-8"},body:`<!doctype html><html><head><meta charset="utf-8"></head><body><li><a href="https://www.coupang.com/vp/products/123456?itemId=11&vendorItemId=22"><img alt="스킨1004 히알루 시카 워터핏 선 세럼 50ml, 2개"></a><div class="ProductUnit_productName">스킨1004 히알루 시카 워터핏 선 세럼 50ml, 2개</div><div class="PriceArea_priceArea">21,800원</div><div>로켓배송</div></li></body></html>`}));
 await page.goto("https://www.coupang.com/np/search?q=ddakdama-fixture");
 const result=await extensionWorker.evaluate(async()=>{const tabs=await chrome.tabs.query({url:"https://www.coupang.com/np/search*"});if(!tabs[0]?.id)throw new Error("FIXTURE_TAB_NOT_FOUND");return chrome.tabs.sendMessage(tabs[0].id,{type:"DDAKDAMA_SEARCH_RESULTS"})});
 expect(result.results).toHaveLength(1);
 expect(result.results[0]).toMatchObject({productId:"123456",vendorItemId:"22",currentPrice:21800,unitsPerPackage:2});
});

test("상세 content script와 preflight URL gate가 동작한다",async({context,page,extensionId,extensionWorker})=>{
 await context.route("https://www.coupang.com/vp/products/123456**",route=>route.fulfill({status:200,headers:{"content-type":"text/html; charset=utf-8"},body:`<!doctype html><html><head><meta charset="utf-8"></head><body><h1>스킨1004 히알루 시카 워터핏 선 세럼 50ml, 2개</h1><div class="total-price"><strong>21,800원</strong></div><button>장바구니</button></body></html>`}));
 await page.goto("https://www.coupang.com/vp/products/123456?itemId=11&vendorItemId=22");
 const detail=await extensionWorker.evaluate(async()=>{const tabs=await chrome.tabs.query({url:"https://www.coupang.com/vp/products/123456*"});if(!tabs[0]?.id)throw new Error("DETAIL_TAB_NOT_FOUND");return chrome.tabs.sendMessage(tabs[0].id,{type:"DDAKDAMA_INSPECT_PRODUCT"})});
 expect(detail).toMatchObject({productId:"123456",vendorItemId:"22",itemId:"11",price:21800,unitsPerPackage:2,inStock:true,securityRequired:false});
 const invalid={id:"line-1",productUrl:"https://evil.example/vp/products/123456?itemId=11&vendorItemId=22",productId:"123456",vendorItemId:"22",itemId:"11",cartPurchaseQuantity:1,expectedUnitsPerPackage:2,expectedUnitSize:"50ml",expectedStrength:null,expectedPackageContent:null,status:"QUEUED"};
 await page.goto(`chrome-extension://${extensionId}/dist/index.html`);
 const rejected=await page.evaluate(job=>chrome.runtime.sendMessage({type:"DDAKDAMA_PREFLIGHT",jobs:[job]}),invalid);
 expect(rejected.results[0]).toMatchObject({status:"PRODUCT_MISMATCH"});
});
