import {test,expect} from "./extension-fixture";

test("닫고 다시 열어도 입력과 연결을 보존하고 공유 링크를 만든다",async({context,page,extensionId})=>{
 const server="https://ddakdama.ddakdama.workers.dev";
 let revokes=0;
 await context.route(`${server}/api/pairing/status`,r=>r.fulfill({json:{connected:true}}));
 await context.route(`${server}/api/device/revoke`,r=>{revokes++;return r.fulfill({json:{ok:true}})});
 await context.route(`${server}/api/handoffs/latest`,r=>r.fulfill({json:{handoff:null}}));
 await page.goto(`chrome-extension://${extensionId}/dist/index.html`);
 await expect(page.locator("#shopping-list")).toBeVisible();
 await page.evaluate(()=>chrome.storage.local.set({"ddakdama-device-token":"fixture-token","ddakdama-pairing-code":"123456","ddakdama-pairing-expires-at":Date.now()-1000}));
 await page.locator("#shopping-list").fill("두부 300g 2개");
 await expect.poll(()=>page.evaluate(async()=>((await chrome.storage.local.get("ddakdama-workspace-v1"))["ddakdama-workspace-v1"] as {input:string})?.input)).toBe("두부 300g 2개");
 await page.close();
 const reopened=await context.newPage();
 await reopened.goto(`chrome-extension://${extensionId}/dist/index.html`);
 await expect(reopened.locator("#shopping-list")).toHaveValue("두부 300g 2개");
 await expect(reopened.getByText("연결됨 · 보낸 목록을 바로 받을 수 있어요",{exact:true})).toBeVisible();
 expect(revokes).toBe(0);
 const shared="https://ddakdama.artemis-clunk.workers.dev/?plan=test&grant=fixture";
 await context.route("https://ddakdama.artemis-clunk.workers.dev/api/gpt/plans",r=>{
  expect(r.request().postDataJSON()).toEqual({shoppingList:"두부 300g 2개",consentToStoreRaw:false});
  return r.fulfill({json:{planUrl:shared}});
 });
 await reopened.getByRole("button",{name:"입력 목록 공유 링크 만들기"}).click();
 await expect(reopened.getByRole("textbox",{name:"생성된 공유 링크"})).toHaveValue(shared);
});

test("쿠팡 페이지의 로그인 표시를 읽고 쿠키나 장바구니를 변경하지 않는다",async({context,page,extensionId})=>{
 await context.route("https://www.coupang.com/",r=>r.fulfill({contentType:"text/html; charset=utf-8",body:'<header><a href="/login">로그인</a></header>'}));
 const shop=await context.newPage();await shop.goto("https://www.coupang.com/");
 await page.goto(`chrome-extension://${extensionId}/dist/index.html`);
 await page.getByRole("button",{name:"로그인 상태 확인"}).click();
 await expect(page.getByText("쿠팡 로그인: 로그인 안 됨 (열린 페이지 기준)")).toBeVisible();
 await shop.evaluate(()=>{document.querySelector("header")!.innerHTML='<a href="/logout">로그아웃</a>'});
 await page.getByRole("button",{name:"로그인 상태 확인"}).click();
 await expect(page.getByText("쿠팡 로그인: 로그인됨 (열린 페이지 기준)")).toBeVisible();
});
