import{test,expect}from"./extension-fixture";

type Product={productId:string;vendorItemId:string;itemId:string;title:string;price:number;query:string};
const productUrl=(product:Product)=>`https://www.coupang.com/vp/products/${product.productId}?itemId=${product.itemId}&vendorItemId=${product.vendorItemId}`;
const cartJob=(product:Product)=>({
 id:`line-${product.productId}`,productUrl:productUrl(product),navigationUrl:`http://127.0.0.1:4174/product/${product.productId}?itemId=${product.itemId}&vendorItemId=${product.vendorItemId}`,
 productId:product.productId,vendorItemId:product.vendorItemId,itemId:product.itemId,expectedBrand:product.query,expectedProductName:product.title,
 cartPurchaseQuantity:1,expectedUnitsPerPackage:1,expectedUnitSize:null,expectedStrength:null,expectedPackageContent:null,status:"QUEUED",
});

test("검색·상세검증·장바구니 작업은 단계별 작업 탭을 재사용한다",async({page,extensionId})=>{
 const products:Product[]=[
  {query:"alpha",productId:"740001",vendorItemId:"840001",itemId:"940001",title:"alpha 올인원 150mL",price:14000},
  {query:"beta",productId:"740002",vendorItemId:"840002",itemId:"940002",title:"beta 선 세럼 50mL",price:12000},
  {query:"gamma",productId:"740003",vendorItemId:"840003",itemId:"940003",title:"gamma 클렌저 150mL",price:9000},
 ];
 const configured=await fetch("http://127.0.0.1:4174/fixture/configure",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({products,quantities:{}})});expect(configured.ok).toBe(true);
 await page.goto(`chrome-extension://${extensionId}/dist/index.html`);
 const observed=async(type:string,payload:Record<string,unknown>)=>page.evaluate(async({type,payload})=>{
  const created:number[]=[];const listener=(tab:chrome.tabs.Tab)=>{if(tab.id!==undefined)created.push(tab.id)};chrome.tabs.onCreated.addListener(listener);
  try{return{response:await chrome.runtime.sendMessage({type,...payload}),created}}finally{chrome.tabs.onCreated.removeListener(listener)}
 },{type,payload});
 const search=await observed("DDAKDAMA_SEARCH_ALL",{items:products.map(product=>({id:product.productId,rawText:product.title}))});
 expect(search.created).toHaveLength(1);
 const jobs=products.map(cartJob);
 const preflight=await observed("DDAKDAMA_PREFLIGHT",{jobs});
 expect(preflight.created).toHaveLength(1);
 expect((preflight.response as {results:{status:string}[]}).results.map(result=>result.status)).toEqual(["READY","READY","READY"]);
 const cartRun=await observed("DDAKDAMA_RUN_CART_JOBS",{runId:crypto.randomUUID(),jobs});
 expect(cartRun.created).toHaveLength(2);
 expect((cartRun.response as {results:{status:string}[]}).results.map(result=>result.status)).toEqual(["SUCCESS","SUCCESS","SUCCESS"]);
});

test("담기는 성공했지만 검증이 실패한 작업을 재개해도 수량을 중복 추가하지 않는다",async({page,extensionId})=>{
 const product:Product={query:"alpha",productId:"750001",vendorItemId:"850001",itemId:"950001",title:"alpha 올인원 150mL",price:14000};
 const quantityKey=`${product.productId}:${product.vendorItemId}:${product.itemId}`;
 const configured=await fetch("http://127.0.0.1:4174/fixture/configure",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({products:[product],quantities:{[quantityKey]:1}})});expect(configured.ok).toBe(true);
 await page.goto(`chrome-extension://${extensionId}/dist/index.html`);
 const job=cartJob(product);const runId="false-negative-run";
 await page.evaluate(({runId,job})=>chrome.storage.local.set({"ddakdama-cart-journal":{runId,jobs:[job],results:[{...job,status:"CART_VERIFICATION_FAILED"}],checkpoints:{[job.id]:{jobId:job.id,beforeQuantity:0,targetQuantity:1,updatedAt:Date.now()}},startedAt:Date.now(),updatedAt:Date.now()}}),{runId,job});
 const resumed=await page.evaluate(()=>chrome.runtime.sendMessage({type:"DDAKDAMA_RESUME_CART_JOURNAL"}));
 expect(resumed.results[0]).toMatchObject({status:"SUCCESS",beforeQuantity:0,afterQuantity:1});
 const state=await fetch("http://127.0.0.1:4174/fixture/state").then(response=>response.json()) as{quantities:Record<string,number>};
 expect(state.quantities[quantityKey]).toBe(1);
});
