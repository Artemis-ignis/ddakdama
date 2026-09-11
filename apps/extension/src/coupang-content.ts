import{parseUnitsPerPackage}from"@ddakdama/core/product";
import{parseWon}from"./coupang-price";
import{readDetailPrice}from"./detail-price";
type CartSnapshot={productId:string;vendorItemId:string|null;itemId:string|null;quantity:number;price:number|null;priceIsLineTotal:boolean;title:string};
const currentIdentity=()=>{const root=document.body?.dataset??{};return{productId:location.pathname.match(/products\/(\d+)/)?.[1]??root.productId??null,vendorItemId:new URL(location.href).searchParams.get("vendorItemId")??root.vendorItemId??null,itemId:new URL(location.href).searchParams.get("itemId")??root.itemId??null}};
// A bare 403 in a review count, price, or product ID is not an HTTP error.
// Keep explicit denial/challenge messages (including image-only pages) gated.
const securityRequired=()=>/^(?:error\s*|http\s*)?403(?:\s|$)/i.test(document.title.trim())||/captcha|access denied|forbidden|HTTP(?:\s+Error)?\s*403|로봇이 아닙니다|보안 확인|사용권한이 없습니다|사용권한이 제한|접근이 제한/i.test(`${document.title} ${location.pathname} ${document.body?.innerText.slice(0,1200)??""} ${[...document.querySelectorAll<HTMLImageElement>("img[alt]")].slice(0,8).map(image=>image.alt).join(" ")}`);
const loginRequired=()=>/\/login|member\/login/i.test(location.pathname)||Boolean(document.querySelector("form[action*='login'],input[type='password']"));
const pageDocumentId=crypto.randomUUID();

// Use the shop's own form and submit handler. Do not fabricate trace fields,
// replay private requests, or navigate directly to a hand-built search URL.
function prepareSearch(query:unknown){
 if(securityRequired())return{ok:false,error:"SECURITY_CHECK_REQUIRED"};
 if(loginRequired())return{ok:false,error:"LOGIN_REQUIRED"};
 if(typeof query!=="string"||!query.trim()||query.length>150)return{ok:false,error:"INVALID_QUERY"};
 const field=[...document.querySelectorAll<HTMLInputElement>('input[name="q"]')].find(input=>{
  if(!input.form||!input.getClientRects().length||getComputedStyle(input).visibility==="hidden")return false;
  const action=new URL(input.form.action,location.href);
  return action.origin===location.origin&&(action.pathname==="/np/search"||(import.meta.env.MODE==="test"&&action.pathname==="/search"));
 });
 if(!field?.form)return{ok:false,error:"SEARCH_FORM_UNAVAILABLE"};
 const form=field.form;
 const setter=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,"value")?.set;
 if(setter)setter.call(field,query.trim());else field.value=query.trim();
 field.dispatchEvent(new Event("input",{bubbles:true}));
 field.dispatchEvent(new Event("change",{bubbles:true}));
 const submit=form.querySelector<HTMLButtonElement|HTMLInputElement>('button[type="submit"],input[type="submit"]');
 // Acknowledge before navigating so a closed message port cannot trigger a
 // second submission. Hidden fields remain entirely under the shop's control.
 setTimeout(()=>{if(submit)submit.click();else form.requestSubmit()},0);
 return{ok:true,documentId:pageDocumentId};
}
function detail(){
 const purchaseArea=document.querySelector<HTMLElement>(".prod-buy,.prod-atf,[data-testid='product-purchase'],.product-main")??document.body??document.documentElement;
 const baseTitle=purchaseArea.querySelector<HTMLElement>(".prod-buy-header__title,[data-testid='product-title'],h1")?.innerText.trim()??"";
 const selectedOption=purchaseArea.querySelector<HTMLElement>("[data-testid='selected-option'],.prod-option__selected,.option-picker-container [aria-selected='true']")?.innerText.trim().replace(/\s+/gu," ")??"";
 const title=[baseTitle,selectedOption].filter(Boolean).join(" ");
 const priceContainer=[...purchaseArea.querySelectorAll<HTMLElement>(".price-container")].find(container=>!container.closest(".related-products,[class*='recommend'],[class*='similar']"));
 const currentPrice=priceContainer?.querySelector<HTMLElement>(".final-price .price-amount,.price-amount.final-price-amount");
 const legacyPrice=purchaseArea.querySelector<HTMLElement>(".total-price strong,.prod-sale-price .total-price,[data-testid='price']");
 const priceText=currentPrice?.innerText??legacyPrice?.innerText??"";
 const add=[...purchaseArea.querySelectorAll<HTMLButtonElement>("button")].find(button=>/장바구니/.test(button.innerText)&&!button.disabled);
 const purchaseButtons=[...purchaseArea.querySelectorAll<HTMLButtonElement>("button")].filter(button=>button.getClientRects().length&&getComputedStyle(button).visibility!=="hidden");
 const membershipRequired=!add&&purchaseButtons.some(button=>!button.disabled&&/로켓\s*와우\s*신청하기|와우\s*멤버십\s*가입/u.test(button.innerText));
 const soldOut=!add&&!membershipRequired&&purchaseButtons.some(button=>/^(?:일시\s*)?품절$|재입고\s*알림/u.test(button.innerText.trim()));
 const optionRequired=[...purchaseArea.querySelectorAll("select,[role='combobox']")].some(element=>{
  if(element instanceof HTMLSelectElement)return element.options.length>1&&!element.value;
  return /선택|골라주세요|옵션/iu.test((element as HTMLElement).innerText.trim())&&!element.getAttribute("data-value");
 });
 return{...currentIdentity(),title,price:readDetailPrice(priceContainer)??parseWon(priceText),unitsPerPackage:parseUnitsPerPackage(title),inStock:!!add,stockStatus:add?"IN_STOCK":soldOut?"OUT_OF_STOCK":"UNKNOWN",membershipRequired,optionRequired,canAdd:!!add&&!optionRequired,securityRequired:securityRequired(),loginRequired:loginRequired()};
}
function cart():CartSnapshot[]{
 const rows=[...document.querySelectorAll<HTMLElement>("[data-product-id],.cart-deal-item,[id^='item_'][data-vid]")];
 return rows.map(row=>{
  const links=[...row.querySelectorAll<HTMLAnchorElement>('a[href*="/vp/products/"]')];const link=links.find(candidate=>candidate.innerText.trim())??links[0];const url=link?new URL(link.href,location.origin):null;
  const datasetLineTotal=row.dataset.lineTotal??row.querySelector<HTMLElement>("[data-line-total]")?.dataset.lineTotal??"";
  const lineTotalElement=row.querySelector<HTMLElement>("[data-testid='line-total-price'],.cart-deal-item__total-price strong,.cart-product-price strong,.cart-deal-item__total-price,.cart-product-price");
  const lineTotal=parseWon(datasetLineTotal,true)??parseWon(lineTotalElement?.innerText??"");
  const priceText=(row.querySelector<HTMLElement>(".price-value,.unit-price-area")?.innerText??row.innerText).replace(/\([^)]*(?:당|개당|ml당|mL당|g당|정당)[^)]*\)/giu,"");const priceMatches=priceText.split(/\r?\n/u).filter(line=>!/적립|캐시|쿠폰|배송비|할인/iu.test(line)).flatMap(line=>line.match(/\d[\d,]*\s*원/g)??[]);
  return{productId:row.dataset.productId??url?.pathname.match(/products\/(\d+)/)?.[1]??"",vendorItemId:row.dataset.vid??url?.searchParams.get("vendorItemId")??null,itemId:url?.searchParams.get("itemId")??null,title:link?.innerText.trim()??"",quantity:Number(row.querySelector<HTMLInputElement>("input.cart-quantity-input,input[type='number'],[data-quantity]")?.value??row.querySelector<HTMLElement>("[data-quantity]")?.dataset.quantity??1),price:lineTotal??parseWon(priceMatches[0]??""),priceIsLineTotal:lineTotal!==null};
 }).filter(item=>item.productId&&Number.isInteger(item.quantity)&&item.quantity>0);
}
type CartTarget={productId:string;vendorItemId:string|null;itemId:string|null};
function selectableCartRows(){
 return [...document.querySelectorAll<HTMLInputElement>('input[type="checkbox"]')].flatMap(box=>{
  let row=box.parentElement;
  while(row&&row!==document.body){
   if(row.querySelectorAll('input[type="checkbox"]').length!==1)break;
   const link=row.querySelector<HTMLAnchorElement>('a[href*="/vp/products/"]');
   if(link){const url=new URL(link.href);return[{box,productId:url.pathname.match(/products\/(\d+)/)?.[1]??"",vendorItemId:url.searchParams.get("vendorItemId")??row.dataset.vid??null,itemId:url.searchParams.get("itemId")}];}
   row=row.parentElement;
  }
  return[];
 });
}
async function selectCartTargets(targets:CartTarget[]){
 if(!(location.hostname==="cart.coupang.com"||(import.meta.env.MODE==="test"&&location.pathname==="/cart")))return{ok:false};
 if(securityRequired()||loginRequired()||!Array.isArray(targets)||targets.length>50)return{ok:false};
 const matches=(row:CartTarget,target:CartTarget)=>row.productId===target.productId&&(target.vendorItemId?row.vendorItemId===target.vendorItemId:!!target.itemId&&row.itemId===target.itemId)&&(!target.itemId||!row.itemId||target.itemId===row.itemId);
 const initial=selectableCartRows();
 if(!initial.length||initial.some(row=>!row.productId||(!row.vendorItemId&&!row.itemId)||row.box.disabled)||targets.some(target=>initial.filter(row=>matches(row,target)).length!==1))return{ok:false};
 for(const original of initial){
  const row=selectableCartRows().find(row=>matches(row,original));
  if(!row||row.box.disabled)return{ok:false};
  const checked=targets.some(target=>matches(row,target));
  if(row.box.checked!==checked){row.box.click();await new Promise(resolve=>setTimeout(resolve,100));}
 }
 const after=selectableCartRows();
 return{ok:after.length===initial.length&&after.every(row=>row.box.checked===targets.some(target=>matches(row,target)))};
}
function searchResults(){
 // Current Coupang search pages use ProductUnit_productUnit__* cards.  Keep
 // legacy cards as fallbacks, but never treat sidebar history as a result.
 const rowSelector='[class*="ProductUnit_productUnit"],li.search-product,li[class*="search-product"],[data-testid*="product-card"]';
 const isSearchRow=(row:HTMLElement)=>Boolean(row.querySelector('a[href*="/vp/products/"]'))&&!row.closest('.recently-viewed-item,[class*="RecentlyViewed"],[data-testid*="recently-viewed"]');
 let rows=[...document.querySelectorAll<HTMLElement>(rowSelector)].filter(isSearchRow);
 if(!rows.length){
  const links=[...document.querySelectorAll<HTMLAnchorElement>('a[href*="/vp/products/"]')];
  rows=links.flatMap(link=>{
   const url=new URL(link.href,location.origin);
   if(url.searchParams.get("sourceType")==="recently_viewed_widget")return[];
   const row=link.closest<HTMLElement>('li,[data-product-id],[class*="ProductUnit_productUnit"],[class*="search-product"]');
   return row&&isSearchRow(row)?[row]:[];
  });
 }
 const seen=new Set<string>();const results=[];
 for(const row of rows){
  const link=[...row.querySelectorAll<HTMLAnchorElement>('a[href*="/vp/products/"]')].find(candidate=>new URL(candidate.href,location.origin).searchParams.get("sourceType")!=="recently_viewed_widget");if(!link)continue;
  const url=new URL(link.href,location.origin);const id=url.pathname.match(/products\/(\d+)/)?.[1];const vendor=url.searchParams.get("vendorItemId");if(!id||seen.has(id+"-"+vendor))continue;seen.add(id+"-"+vendor);
  const title=(row.querySelector<HTMLElement>('[class*="ProductUnit_productName"],[class*="product-name"],[data-testid="product-name"]')?.innerText||row.querySelector<HTMLImageElement>("img[alt]")?.alt||link.innerText.split("\n")[0]||"").trim();
  const priceArea=row.querySelector<HTMLElement>('[class*="PriceArea_priceArea"],[class*="price-area"],[data-testid="price-area"]')?.innerText||row.innerText||"";
  const salePriceText=priceArea
   .split(/\r?\n/u)
   .filter(line=>!/배송비|적립|캐시|쿠폰|혜택/iu.test(line))
   .join("\n")
   .replace(/\([^)]*(?:당|개당|ml당|mL당|g당|정당)[^)]*\)/giu,"");
  const priceMatches=salePriceText.match(/\d[\d,]*\s*원/g)||[];const price=parseWon(priceMatches.at(-1)||"");
  const ratingText=row.querySelector<HTMLElement>('[class*="ProductRating_productRating"]')?.getAttribute("aria-label")||"";const reviewText=row.querySelector<HTMLElement>('[class*="ProductRating_productRating"]')?.innerText||"";
  const image=row.querySelector<HTMLImageElement>("img");
  const deliveryText=row.innerText;const shippingMatch=deliveryText.match(/\ubc30\uc1a1\ube44\s*([0-9,]+)/u);const shippingFee=shippingMatch?parseWon(shippingMatch[1]??"",true):null;const fulfillmentType=/\ub85c\ucf13\ud504\ub808\uc2dc/u.test(deliveryText)?"ROCKET_FRESH":/\ub85c\ucf13\uc9c1\uad6c/u.test(deliveryText)?"ROCKET_DIRECT":/\ub85c\ucf13/u.test(deliveryText)?"ROCKET":shippingMatch?"SELLER_DELIVERY":"UNKNOWN";const deliveryPromise=deliveryText.split(/\r?\n/u).find(line=>/\ub3c4\ucc29|\ub0b4\uc77c|\uc624\ub298|\uc77c\ub0b4/u.test(line))?.trim()??null;
  results.push({id:id+"-"+(vendor||url.searchParams.get("itemId")||""),productId:id,vendorItemId:vendor,itemId:url.searchParams.get("itemId"),title,currentPrice:price,unitsPerPackage:parseUnitsPerPackage(title),productUrl:url.href,canonicalUrl:url.href,partnersSearchUrl:null,affiliateUrl:null,affiliateVerified:false,shippingFee,fulfillmentType,deliveryPromise,deliveryCertainty:shippingFee===null?"UNKNOWN":"CONFIRMED",imageUrl:image?.currentSrc||image?.src||image?.dataset.src||image?.dataset.imgSrc||null,rocketDelivery:fulfillmentType==="ROCKET"||fulfillmentType==="ROCKET_FRESH"||fulfillmentType==="ROCKET_DIRECT",rating:Number(ratingText.replace(/[^0-9.]/g,""))||null,reviewCount:Number(reviewText.replace(/[^0-9]/g,""))||null,advertised:/\uad11\uace0|Ad information/.test(row.innerText),source:"BROWSER"});if(results.length>=40)break;
 }
 return{results,productCardCount:rows.length};
}
// A DOM data attribute survives extension reloads. It must not prevent a new
// content-script context from registering its listener on an already open tab.
type ContentListener=Parameters<typeof chrome.runtime.onMessage.addListener>[0];
const contentContext=globalThis as typeof globalThis&{__ddakdamaListener?:ContentListener};
if(!contentContext.__ddakdamaListener||!chrome.runtime.onMessage.hasListener(contentContext.__ddakdamaListener)){
 const listener:ContentListener=(message,_sender,respond)=>{
  if(message?.type==="DDAKDAMA_PING_CONTENT")respond({ok:true,documentId:pageDocumentId,pageReady:document.readyState!=="loading"});
  if(message?.type==="DDAKDAMA_LOGIN_STATUS"){
   const header=document.querySelector("#wa-header,.wa-header,header,#header");
   const labels=[...(header?.querySelectorAll("a,button")??[])].filter(el=>(el as HTMLElement).getClientRects().length).map(el=>el.textContent?.trim());
   respond({status:securityRequired()?"UNKNOWN":labels.includes("로그아웃")?"SIGNED_IN":labels.includes("로그인")?"SIGNED_OUT":"UNKNOWN"});
  }
  if(message?.type==="DDAKDAMA_SUBMIT_SEARCH")respond(prepareSearch(message.query));
  if(message?.type==="DDAKDAMA_SEARCH_RESULTS"){const parsed=searchResults();respond({...parsed,documentId:pageDocumentId,query:new URL(location.href).searchParams.get("q"),securityRequired:securityRequired(),loginRequired:loginRequired(),pageReady:document.readyState!=="loading",productLinkCount:document.querySelectorAll('a[href*="/vp/products/"]').length});}
  if(message?.type==="DDAKDAMA_INSPECT_PRODUCT")respond(detail());
  if(message?.type==="DDAKDAMA_CART_SNAPSHOT"){const items=cart();const count=document.body?.innerText.slice(0,500).match(/장바구니\s*\((\d+)\)/u);respond({items,readable:!count||Number(count[1])===items.length});}
  if(message?.type==="DDAKDAMA_SELECT_CART_ITEMS"){void selectCartTargets(message.targets).then(respond).catch(()=>respond({ok:false}));return true;}
  if(message?.type==="DDAKDAMA_ADD_TO_CART"){
   const info=detail();if(info.securityRequired){respond({ok:false,reason:"SECURITY_CHECK_REQUIRED"});return}if(info.loginRequired){respond({ok:false,reason:"LOGIN_REQUIRED"});return}if(!info.canAdd){respond({ok:false,reason:info.optionRequired?"OPTION_REQUIRED":"ADD_BUTTON_NOT_FOUND"});return}
   const purchaseArea=document.querySelector<HTMLElement>(".prod-buy,.prod-atf,[data-testid='product-purchase'],.product-main")??document.body;const button=[...purchaseArea.querySelectorAll<HTMLButtonElement>("button")].find(candidate=>/장바구니/.test(candidate.innerText)&&!candidate.disabled);button?.click();respond({ok:true,productId:info.productId,vendorItemId:info.vendorItemId});
  }
  return false;
 };
 contentContext.__ddakdamaListener=listener;
 chrome.runtime.onMessage.addListener(listener);
}
