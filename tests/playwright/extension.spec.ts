import{test,expect}from"./extension-fixture";
import{Client}from"@modelcontextprotocol/sdk/client/index.js";
import{StreamableHTTPClientTransport}from"@modelcontextprotocol/sdk/client/streamableHttp.js";

const LIVE_ORIGIN="https://ddakdama.ddakdama.workers.dev";
const GOLDEN_LIST=[
 "닥터지 레드 블레미쉬 포 맨 진정 올인원 150ml",
 "스킨1004 히알루 시카 워터핏 선 세럼 50ml 2개",
 "라운드랩 1025 독도 클렌저 150ml 2개",
 "TS 골드플러스 샴푸 500g",
 "닥터스베스트 고흡수 마그네슘 100mg 240정",
].join("\n");

type CartFixtureProduct={
 productId:string;
 vendorItemId:string;
 itemId:string;
 title:string;
 price:number|null;
 query?:string;
 optionRequired?:boolean;
 delayedPriceMs?:number;
 delayedButtonMs?:number;
 detailTitle?:string;
 cartOmitsIdentifiers?:boolean;
 cartNoisyLineTotal?:boolean;
};

const productUrl=(product:CartFixtureProduct)=>`https://www.coupang.com/vp/products/${product.productId}?itemId=${product.itemId}&vendorItemId=${product.vendorItemId}`;
const cartJob=(product:CartFixtureProduct,quantity=1)=>({
 id:`line-${product.productId}`,
 productUrl:productUrl(product),
 navigationUrl:`http://127.0.0.1:4174/product/${product.productId}?itemId=${product.itemId}&vendorItemId=${product.vendorItemId}`,
 productId:product.productId,
 vendorItemId:product.vendorItemId,
 itemId:product.itemId,
 expectedBrand:product.title.split(/\s+/u)[0]??null,
 expectedProductName:product.title,
 cartPurchaseQuantity:quantity,
 expectedUnitsPerPackage:Number(product.title.match(/,\s*(\d+)\s*개\s*$/u)?.[1]??1),
 expectedUnitSize:product.title.match(/(\d+\s*mL)/iu)?.[1]?.replace(/\s/g,"")??null,
 expectedStrength:product.title.match(/(\d+\s*mg)/iu)?.[1]?.replace(/\s/g,"")??null,
 expectedPackageContent:product.title.match(/(\d+\s*정)/u)?.[1]?.replace(/\s/g,"")??null,
 status:"QUEUED",
});
async function installCartFixture(products:CartFixtureProduct[],quantities:Record<string,number>={}){const response=await fetch("http://127.0.0.1:4174/fixture/configure",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({products,quantities})});expect(response.ok).toBe(true)}
async function fixtureQuantities(){const response=await fetch("http://127.0.0.1:4174/fixture/state");return(response.json() as Promise<{quantities:Record<string,number>}>).then(value=>value.quantities)}
const goldenProducts=():CartFixtureProduct[]=>[
 {query:"닥터지",productId:"730001",vendorItemId:"830001",itemId:"930001",title:"닥터지 레드 블레미쉬 포 맨 진정 올인원, 150ml, 1개",price:14360},
 {query:"스킨1004",productId:"730002",vendorItemId:"830002",itemId:"930002",title:"스킨1004 히알루 시카 워터핏 선 세럼, 50ml, 2개",price:21800},
 {query:"라운드랩",productId:"730003",vendorItemId:"830003",itemId:"930003",title:"라운드랩 1025 독도 클렌저, 150ml, 2개",price:18100},
 {query:"TS",productId:"730004",vendorItemId:"830004",itemId:"930004",title:"TS 골드플러스 샴푸, 500g, 1개",price:11540},
 {query:"닥터스베스트",productId:"730005",vendorItemId:"830005",itemId:"930005",title:"닥터스베스트 고흡수 마그네슘, 100mg, 240정, 1개",price:26450},
];

test("Manifest V3 서비스 워커와 Side Panel이 실제 Chromium에서 동작한다",async({page,extensionId,extensionWorker})=>{
 expect(extensionWorker.url()).toContain(`chrome-extension://${extensionId}/dist/background.js`);
 await page.goto(`chrome-extension://${extensionId}/dist/index.html`);
 await expect(page.getByRole("heading",{name:"쇼핑 목록을 준비해 주세요"})).toBeVisible();
 await expect(page.getByRole("button",{name:"목록을 입력해 주세요"})).toBeDisabled();
 await expect(page.getByText("ChatGPT에서 목록 받기")).toBeVisible();
 await expect(page.getByText("MCP URL")).toHaveCount(0);
 const ping=await page.evaluate(()=>chrome.runtime.sendMessage({type:"DDAKDAMA_PING"}));
 expect(ping).toEqual({ok:true,name:"ddakdama",version:"1.0.0",affiliateEnabled:false});
 await page.evaluate(async()=>{await chrome.storage.local.set({"playwright-storage-check":"ok"})});
 expect(await page.evaluate(async()=>(await chrome.storage.local.get("playwright-storage-check"))["playwright-storage-check"])).toBe("ok");
});

test("공개 서버에서 코드 발급만으로 연결 완료를 오인하지 않고 새 코드로 재시도한다",async({page,extensionId})=>{
 test.skip(process.env.DDAKDAMA_LIVE_PAIRING!=="1","공개 서버를 호출하는 선택적 실연결 검사");
 await page.goto(`chrome-extension://${extensionId}/dist/index.html`);
 await page.evaluate(async()=>chrome.storage.local.remove(["ddakdama-device-id","ddakdama-device-token","ddakdama-pairing-code","ddakdama-pairing-expires-at"]));
 await page.reload();
 await page.getByRole("button",{name:"6자리 코드 만들기"}).click();
 const firstCode=page.locator("output.pairing-code");
 await expect(firstCode).toHaveText(/^\d{3} \d{3}$/,{timeout:15_000});
 const firstCodeText=(await firstCode.textContent())?.trim();
 const firstDevice=await page.evaluate(async()=>(await chrome.storage.local.get("ddakdama-device-id"))["ddakdama-device-id"]);
 await page.getByRole("button",{name:"목록 받기"}).click();
 await expect(page.getByText("아직 연결되지 않았습니다.",{exact:false})).toBeVisible();
 await expect(firstCode).toHaveText(/^\d{3} \d{3}$/);
 await expect(page.getByText("연결됨",{exact:true})).toHaveCount(0);
 await page.getByRole("button",{name:"새 코드"}).click();
 await expect.poll(async()=>(await page.locator("output.pairing-code").textContent())?.trim(),{timeout:15_000}).not.toBe(firstCodeText);
 const secondDevice=await page.evaluate(async()=>(await chrome.storage.local.get("ddakdama-device-id"))["ddakdama-device-id"]);
 expect(secondDevice).not.toBe(firstDevice);
});

test("공개 MCP와 실제 확장 프로그램이 페어링하고 5종·실물 7개 목록을 끝까지 수신한다",async({page,extensionId})=>{
 test.skip(process.env.DDAKDAMA_LIVE_PAIRING!=="1","공개 서버를 호출하는 선택적 실연결 검사");
 test.setTimeout(60_000);
 await page.goto(`chrome-extension://${extensionId}/dist/index.html`);
 await page.evaluate(async()=>chrome.storage.local.remove(["ddakdama-device-id","ddakdama-device-token","ddakdama-pairing-code","ddakdama-pairing-expires-at"]));
 await page.reload();
 await page.getByRole("button",{name:"6자리 코드 만들기"}).click();
 const code=(await page.locator("output.pairing-code").textContent())?.replace(/\s/g,"")??"";
 expect(code).toMatch(/^\d{6}$/);
 const deviceToken=await page.evaluate(async()=>String((await chrome.storage.local.get("ddakdama-device-token"))["ddakdama-device-token"]??""));
 expect(deviceToken.length).toBeGreaterThan(32);

 const client=new Client({name:"ddakdama-extension-e2e",version:"1.0.0"});
 await client.connect(new StreamableHTTPClientTransport(new URL(`${LIVE_ORIGIN}/mcp`)));
 try{
  const parsed=await client.callTool({name:"parse_shopping_list",arguments:{shopping_list:GOLDEN_LIST}});
  const items=(parsed.structuredContent as{items?:Array<{requestedPhysicalUnits:number}>}|undefined)?.items??[];
  expect(items).toHaveLength(5);
  expect(items.reduce((sum,item)=>sum+item.requestedPhysicalUnits,0)).toBe(7);

  const paired=await client.callTool({name:"pair_extension_device",arguments:{pairing_code:code,pairing_nonce:crypto.randomUUID()}});
  const connectionGrant=String((paired._meta as{connectionGrant?:string}|undefined)?.connectionGrant??"");
  expect(paired.structuredContent).toMatchObject({connected:true});
  expect(connectionGrant.length).toBeGreaterThan(32);

  const sent=await client.callTool({
   name:"send_cart_plan",
   arguments:{items,connection_grant:connectionGrant,idempotency_key:`extension-e2e-${crypto.randomUUID()}`},
  });
  const handoffId=String((sent._meta as{handoffId?:string}|undefined)?.handoffId??"");
  expect(sent.structuredContent).toMatchObject({sent:true});
  expect(handoffId).not.toBe("");

  await page.getByRole("button",{name:"목록 받기"}).click();
  await expect(page.getByRole("heading",{name:"상품 5종 · 실물 7개"})).toBeVisible({timeout:15_000});
  await expect(page.locator("#shopping-list")).toHaveValue(GOLDEN_LIST);
  await expect(page.getByText("연결됨 · 보낸 목록을 바로 받을 수 있어요",{exact:true})).toBeVisible();

  const status=await client.callTool({name:"get_cart_plan_status",arguments:{handoff_id:handoffId,connection_grant:connectionGrant}});
  expect(status.structuredContent).toMatchObject({received:true,expired:false});

  await page.getByRole("button",{name:"연결 해제"}).click();
  await expect(page.getByRole("button",{name:"6자리 코드 만들기"})).toBeVisible();
  const revoked=await fetch(`${LIVE_ORIGIN}/api/pairing/status`,{headers:{authorization:`Bearer ${deviceToken}`}});
  expect(revoked.status).toBe(401);
 }finally{
  await client.close();
 }
});

test("Side Panel 재시작 후 중단된 journal을 복구 대상으로 표시하고 안전하게 지운다",async({page,extensionId})=>{
 const product:CartFixtureProduct={productId:"710001",vendorItemId:"810001",itemId:"910001",title:"닥터지 레드 블레미쉬 포 맨 진정 올인원 150mL",price:16000};const job=cartJob(product);
 await page.goto(`chrome-extension://${extensionId}/dist/index.html`);
 await page.evaluate(async job=>chrome.storage.local.set({"ddakdama-cart-journal":{runId:"recoverable-run",jobs:[job],results:[],checkpoints:{},startedAt:Date.now(),updatedAt:Date.now()}}),job);
 await page.reload();await expect(page.getByText("중단된 담기 작업이 있어요")).toBeVisible();await expect(page.getByRole("button",{name:"이어서 담기"})).toBeVisible();await page.getByRole("button",{name:"기록 지우기"}).click();await expect(page.getByText("중단된 담기 작업이 있어요")).toHaveCount(0);expect(await page.evaluate(async()=>Boolean((await chrome.storage.local.get("ddakdama-cart-journal"))["ddakdama-cart-journal"]))).toBe(false)
});

test("쿠팡 URL에 content script가 주입되어 배송비가 아닌 판매가를 구조화한다",async({context,page,extensionWorker})=>{
 await context.route("https://www.coupang.com/np/search**",route=>route.fulfill({status:200,headers:{"content-type":"text/html; charset=utf-8"},body:`<!doctype html><html><head><meta charset="utf-8"></head><body><li class="recently-viewed-item"><a href="https://www.coupang.com/vp/products/999999?sourceType=recently_viewed_widget"><img alt="최근 본 다른 상품"></a><div class="ProductUnit_productName">최근 본 다른 상품</div><div class="PriceArea_priceArea">1,000원</div></li><li><a href="https://www.coupang.com/vp/products/123456?itemId=11&vendorItemId=22&sourceType=search"><img alt="스킨1004 히알루 시카 워터핏 선 세럼 50ml, 2개"></a><div class="ProductUnit_productName">스킨1004 히알루 시카 워터핏 선 세럼 50ml, 2개</div><div class="PriceArea_priceArea"><del>32,000원</del><div>30%</div><div>21,800원</div><span>(10ml당 2,180원)</span><div>배송비 3,000원</div><div>최대 218원 적립</div></div><div>로켓배송</div></li></body></html>`}));
 await page.goto("https://www.coupang.com/np/search?q=ddakdama-fixture");
 const result=await extensionWorker.evaluate(async()=>{const tabs=await chrome.tabs.query({url:"https://www.coupang.com/np/search*"});if(!tabs[0]?.id)throw new Error("FIXTURE_TAB_NOT_FOUND");return chrome.tabs.sendMessage(tabs[0].id,{type:"DDAKDAMA_SEARCH_RESULTS"})});
 expect(result.results).toHaveLength(1);
 expect(result.results[0]).toMatchObject({productId:"123456",vendorItemId:"22",currentPrice:21800,unitsPerPackage:2});
 expect(result.results[0].productId).not.toBe("999999");
});

test("검색가격이 없어도 고정 5종을 선택하고 상세가격 5/5를 확인한다",async({page,extensionId})=>{
 const products=goldenProducts();
 await installCartFixture(products);
 await page.goto(`chrome-extension://${extensionId}/dist/index.html`);
 const probe=await page.evaluate(rawText=>chrome.runtime.sendMessage({type:"DDAKDAMA_SEARCH_ALL",items:[{id:"probe",rawText}]}),"닥터지 레드 블레미쉬 포 맨 진정 올인원 150ml");
 expect(probe.output?.[0]?.results,JSON.stringify(probe)).toHaveLength(1);
 await page.getByRole("button",{name:"예시 불러오기"}).click();
 await page.getByRole("button",{name:"실제 상품 찾기"}).click();
 await expect(page.getByText("5/5종 선택",{exact:true})).toBeVisible({timeout:20000});
 await expect(page.getByTestId("estimated-total")).toHaveText("상세 확인 5종");
 await page.getByRole("button",{name:/닥터지.*이 품목 빼기/}).click();
 await expect(page.getByText("4/4종 선택",{exact:true})).toBeVisible();
 await expect(page.getByText("제외 1종",{exact:true})).toBeVisible();
 await expect(page.getByTestId("estimated-total")).toHaveText("상세 확인 4종");
 await page.getByTestId("product-0").getByRole("button",{name:"다시 포함"}).click();
 await expect(page.getByText("5/5종 선택",{exact:true})).toBeVisible();
 await expect(page.getByText("제외 1종",{exact:true})).toHaveCount(0);
 await expect(page.getByTestId("estimated-total")).toHaveText("상세 확인 5종");
 const detailButton=page.getByRole("button",{name:"5종 상세 확인하기"});
 await expect(detailButton).toBeEnabled();
 await expect(page.getByText("상세에서 가격 확인")).toHaveCount(5);
 const preflight=await page.evaluate(jobs=>chrome.runtime.sendMessage({type:"DDAKDAMA_PREFLIGHT",jobs}),products.map(product=>cartJob(product)));
 expect(preflight.results.map((result:{status:string})=>result.status)).toEqual(["READY","READY","READY","READY","READY"]);
});

test("고정 5종을 실제 UI로 검증·담기하고 가격 합계·장바구니 이동·새 목록을 제공한다",async({context,page,extensionId})=>{
 test.setTimeout(90_000);
 await installCartFixture(goldenProducts());
 await page.goto(`chrome-extension://${extensionId}/dist/index.html`);
 await page.getByRole("button",{name:"예시 불러오기"}).click();
 await page.getByRole("button",{name:"실제 상품 찾기"}).click();
 await expect(page.getByText("5/5종 선택",{exact:true})).toBeVisible({timeout:20_000});
 await page.getByRole("button",{name:"5종 상세 확인하기"}).click();
 await expect(page.getByRole("heading",{name:"담기 전 확인"})).toBeVisible({timeout:30_000});
 await expect(page.getByRole("button",{name:"5종 장바구니에 담기"})).toBeEnabled();
 await page.getByRole("button",{name:"5종 장바구니에 담기"}).click();
 await expect(page.getByRole("heading",{name:"정확하게 모두 담았어요"})).toBeVisible({timeout:35_000});
 await expect(page.getByLabel("담은 상품 가격 합계").getByText("92,250원",{exact:true})).toHaveCount(2);
 const footer=page.locator("footer");
 const openCart=footer.getByRole("button",{name:"쿠팡 장바구니 보기"});
 const newList=footer.getByRole("button",{name:"새 목록 담기"});
 await expect(openCart).toBeVisible();
 await expect(newList).toBeVisible();
 const cartPagePromise=context.waitForEvent("page");
 await openCart.click();
 const cartPage=await cartPagePromise;
 await expect(cartPage).toHaveURL(/127\.0\.0\.1:4174\/cart/);
 await cartPage.close();
 await newList.click();
 await expect(page.getByRole("heading",{name:"쇼핑 목록을 준비해 주세요"})).toBeVisible();
 await expect(page.locator("#shopping-list")).toHaveValue("");
});

test("상세 content script와 preflight URL gate가 동작한다",async({context,page,extensionId,extensionWorker})=>{
 await context.route("https://www.coupang.com/vp/products/123456**",route=>route.fulfill({status:200,headers:{"content-type":"text/html; charset=utf-8"},body:`<!doctype html><html><head><meta charset="utf-8"></head><body><h1>스킨1004 히알루 시카 워터핏 선 세럼 50ml, 2개</h1><div class="price-container"><div class="final-price"><div class="price-amount final-price-amount">21,800원</div></div></div><button>장바구니</button><section class="related-products"><div class="price-amount final-price-amount">999원</div></section></body></html>`}));
 await page.goto("https://www.coupang.com/vp/products/123456?itemId=11&vendorItemId=22");
 const detail=await extensionWorker.evaluate(async()=>{const tabs=await chrome.tabs.query({url:"https://www.coupang.com/vp/products/123456*"});if(!tabs[0]?.id)throw new Error("DETAIL_TAB_NOT_FOUND");return chrome.tabs.sendMessage(tabs[0].id,{type:"DDAKDAMA_INSPECT_PRODUCT"})});
 expect(detail).toMatchObject({productId:"123456",vendorItemId:"22",itemId:"11",price:21800,unitsPerPackage:2,inStock:true,securityRequired:false});
 const invalid={id:"line-1",productUrl:"https://evil.example/vp/products/123456?itemId=11&vendorItemId=22",productId:"123456",vendorItemId:"22",itemId:"11",cartPurchaseQuantity:1,expectedBrand:"스킨1004",expectedProductName:"스킨1004 히알루 시카 워터핏 선 세럼",expectedUnitsPerPackage:2,expectedUnitSize:"50ml",expectedStrength:null,expectedPackageContent:null,status:"QUEUED"};
 await page.goto(`chrome-extension://${extensionId}/dist/index.html`);
 const rejected=await page.evaluate(job=>chrome.runtime.sendMessage({type:"DDAKDAMA_PREFLIGHT",jobs:[job]}),invalid);
 expect(rejected.results[0]).toMatchObject({status:"PRODUCT_MISMATCH"});
});

test("상세 가격과 담기 버튼이 늦게 삽입되어도 구매 영역만 제한적으로 재확인한다",async({page,extensionId})=>{
 const product:CartFixtureProduct={productId:"720001",vendorItemId:"820001",itemId:"920001",title:"닥터지 레드 블레미쉬 포 맨 진정 올인원 150mL",price:14360,delayedPriceMs:400,delayedButtonMs:800};
 await installCartFixture([product]);
 await page.goto(`chrome-extension://${extensionId}/dist/index.html`);
 const preflight=await page.evaluate(job=>chrome.runtime.sendMessage({type:"DDAKDAMA_PREFLIGHT",jobs:[job]}),cartJob(product));
 expect(preflight.results[0]).toMatchObject({status:"READY",verifiedPrice:14360});
});

test("실제 background 상태머신이 복합 SKU 수량 delta를 검증하고 같은 runId 재개 시 중복 추가하지 않는다",async({page,extensionId})=>{
 const product:CartFixtureProduct={productId:"700001",vendorItemId:"800001",itemId:"900001",title:"스킨1004 히알루 시카 워터핏 선 세럼 50mL, 2개",price:21800};
 await installCartFixture([product],{[`${product.productId}:${product.vendorItemId}:${product.itemId}`]:1});
 await page.goto(`chrome-extension://${extensionId}/dist/index.html`);
 const job=cartJob(product,2);
 const preflight=await page.evaluate(job=>chrome.runtime.sendMessage({type:"DDAKDAMA_PREFLIGHT",jobs:[job]}),job);
 expect(preflight.results[0]).toMatchObject({status:"READY",verifiedPrice:21800});
 const runId=crypto.randomUUID();
 const first=await page.evaluate(({runId,job})=>chrome.runtime.sendMessage({type:"DDAKDAMA_RUN_CART_JOBS",runId,jobs:[job]}),{runId,job});
 expect(first.results[0]).toMatchObject({status:"SUCCESS",beforeQuantity:1,afterQuantity:3,verifiedPrice:21800,beforeCartPrice:21800,cartPrice:65400,expectedSubtotal:43600,cartAddedSubtotal:43600,priceDifference:0});
 expect((await fixtureQuantities())[`${product.productId}:${product.vendorItemId}:${product.itemId}`]).toBe(3);
 const resumed=await page.evaluate(({runId,job})=>chrome.runtime.sendMessage({type:"DDAKDAMA_RUN_CART_JOBS",runId,jobs:[job]}),{runId,job});
 expect(resumed.results[0]).toMatchObject({status:"SUCCESS",beforeQuantity:1,afterQuantity:3});
 expect((await fixtureQuantities())[`${product.productId}:${product.vendorItemId}:${product.itemId}`]).toBe(3);
});

test("장바구니 행에 가격·적립·주문번호 숫자가 함께 있어도 실제 상품금액만 읽는다",async({page,extensionId})=>{
 const product:CartFixtureProduct={productId:"700030",vendorItemId:"800030",itemId:"900030",title:"닥터지 레드 블레미쉬 포 맨 진정 올인원 150mL",price:16830,cartNoisyLineTotal:true};
 await installCartFixture([product]);
 await page.goto(`chrome-extension://${extensionId}/dist/index.html`);
 const response=await page.evaluate(job=>chrome.runtime.sendMessage({type:"DDAKDAMA_RUN_CART_JOBS",runId:crypto.randomUUID(),jobs:[job]}),cartJob(product));
 expect(response.results[0]).toMatchObject({status:"SUCCESS",verifiedPrice:16830,cartPrice:16830,expectedSubtotal:16830,cartAddedSubtotal:16830,priceDifference:0});
 expect(response.results[0].cartPrice).toBeLessThan(1_000_000_000);
});

test("검색·상세 제목이 다르고 장바구니에서 옵션 ID가 생략돼도 같은 단일 SKU의 수량과 가격을 검증한다",async({page,extensionId})=>{
 const product:CartFixtureProduct={productId:"700020",vendorItemId:"800020",itemId:"900020",title:"[로켓프레시] 하림 닭강정 에어프라이어 1kg, 2개",detailTitle:"하림 닭강정 1kg",price:12900,cartOmitsIdentifiers:true};
 await installCartFixture([product]);
 await page.goto(`chrome-extension://${extensionId}/dist/index.html`);
 const job=cartJob(product);
 const preflight=await page.evaluate(job=>chrome.runtime.sendMessage({type:"DDAKDAMA_PREFLIGHT",jobs:[job]}),job);
 expect(preflight.results[0]).toMatchObject({status:"READY",verifiedPrice:12900});
 const response=await page.evaluate(job=>chrome.runtime.sendMessage({type:"DDAKDAMA_RUN_CART_JOBS",runId:crypto.randomUUID(),jobs:[job]}),job);
 expect(response.results[0]).toMatchObject({status:"SUCCESS",beforeQuantity:0,afterQuantity:1,expectedSubtotal:12900,cartAddedSubtotal:12900});
});

test("가격 미확인과 필수 옵션을 분리하고 성공 상품과 함께 부분 실패로 반환한다",async({page,extensionId})=>{
 const products:CartFixtureProduct[]=[
  {productId:"700010",vendorItemId:"800010",itemId:"900010",title:"닥터지 레드 블레미쉬 포 맨 진정 올인원 150mL",price:16000},
  {productId:"700011",vendorItemId:"800011",itemId:"900011",title:"TS 골드플러스 샴푸 500g",price:null},
  {productId:"700012",vendorItemId:"800012",itemId:"900012",title:"라운드랩 1025 독도 클렌저 150mL",price:11000,optionRequired:true},
 ];
 await installCartFixture(products);
 await page.goto(`chrome-extension://${extensionId}/dist/index.html`);
 const jobs=products.map(product=>cartJob(product));
 const preflight=await page.evaluate(jobs=>chrome.runtime.sendMessage({type:"DDAKDAMA_PREFLIGHT",jobs}),jobs);
 expect(preflight.results.map((result:{status:string})=>result.status)).toEqual(["READY","PRICE_UNVERIFIED","OPTION_REQUIRED"]);
 const response=await page.evaluate(jobs=>chrome.runtime.sendMessage({type:"DDAKDAMA_RUN_CART_JOBS",runId:crypto.randomUUID(),jobs}),jobs);
 expect(response.results.map((result:{status:string})=>result.status)).toEqual(["SUCCESS","PRICE_UNVERIFIED","OPTION_REQUIRED"]);
 expect(response.results.filter((result:{status:string})=>result.status==="SUCCESS")).toHaveLength(1);
 const quantities=await fixtureQuantities();
 expect(quantities[`${products[0].productId}:${products[0].vendorItemId}:${products[0].itemId}`]).toBe(1);
 expect(quantities[`${products[1].productId}:${products[1].vendorItemId}:${products[1].itemId}`]).toBe(0);
 expect(quantities[`${products[2].productId}:${products[2].vendorItemId}:${products[2].itemId}`]).toBe(0);
});
