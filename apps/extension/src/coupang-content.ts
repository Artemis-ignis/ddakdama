import{parseUnitsPerPackage}from"@ddakdama/core/product";
type CartSnapshot={productId:string;vendorItemId:string|null;itemId:string|null;quantity:number;price:number|null;title:string};
const won=(text:string)=>{const n=Number(text.replace(/[^0-9]/g,""));return Number.isFinite(n)&&n>0?n:null};
const currentIdentity=()=>{const root=document.body?.dataset??{};return{productId:location.pathname.match(/products\/(\d+)/)?.[1]??root.productId??null,vendorItemId:new URL(location.href).searchParams.get("vendorItemId")??root.vendorItemId??null,itemId:new URL(location.href).searchParams.get("itemId")??root.itemId??null}};
const securityRequired=()=>/captcha|access denied|로봇|보안 확인|접근이 제한/i.test(`${document.title} ${location.pathname} ${document.body?.innerText.slice(0,500)??""}`);
const loginRequired=()=>/\/login|member\/login/i.test(location.pathname)||Boolean(document.querySelector("form[action*='login'],input[type='password']"));
function detail(){
 const title=document.querySelector<HTMLElement>(".prod-buy-header__title,[data-testid='product-title'],h1")?.innerText.trim()??"";
 const purchaseArea=document.querySelector<HTMLElement>(".prod-buy,.prod-atf,[data-testid='product-purchase'],.product-main")??document.body;
 const priceContainer=[...purchaseArea.querySelectorAll<HTMLElement>(".price-container")].find(container=>!container.closest(".related-products,[class*='recommend'],[class*='similar']"));
 const currentPrice=priceContainer?.querySelector<HTMLElement>(".final-price .price-amount,.price-amount.final-price-amount");
 const legacyPrice=purchaseArea.querySelector<HTMLElement>(".total-price strong,.prod-sale-price .total-price,[data-testid='price']");
 const priceText=currentPrice?.innerText??legacyPrice?.innerText??"";
 const add=[...document.querySelectorAll<HTMLButtonElement>("button")].find(button=>/장바구니/.test(button.innerText)&&!button.disabled);
 const optionRequired=[...document.querySelectorAll("select,[role='combobox']")].some(element=>!(element as HTMLSelectElement).value);
 return{...currentIdentity(),title,price:won(priceText),unitsPerPackage:parseUnitsPerPackage(title),inStock:!!add,optionRequired,canAdd:!!add&&!optionRequired,securityRequired:securityRequired(),loginRequired:loginRequired()};
}
function cart():CartSnapshot[]{
 return[...document.querySelectorAll<HTMLElement>("[data-product-id],.cart-deal-item")].map(row=>{const link=row.querySelector<HTMLAnchorElement>('a[href*="/vp/products/"]');const url=link?new URL(link.href,location.origin):null;return{productId:row.dataset.productId??url?.pathname.match(/products\/(\d+)/)?.[1]??"",vendorItemId:url?.searchParams.get("vendorItemId")??null,itemId:url?.searchParams.get("itemId")??null,title:row.querySelector<HTMLElement>(".product-name,a")?.innerText.trim()??"",quantity:Number(row.querySelector<HTMLInputElement>("input[type='number']")?.value??row.querySelector<HTMLElement>("[data-quantity]")?.dataset.quantity??1),price:won(row.dataset.lineTotal??row.querySelector<HTMLElement>(".price-value,.unit-price-area,[data-line-total]")?.innerText??"")}}).filter(item=>item.productId);
}
function searchResults(){
 const rows=[...document.querySelectorAll<HTMLAnchorElement>('a[href*="/vp/products/"][href*="vendorItemId"]')].map(link=>link.closest<HTMLElement>("li")).filter((row):row is HTMLElement=>Boolean(row&&!row.classList.contains("recently-viewed-item")));
 const seen=new Set<string>();const results=[];
 for(const row of rows){
  const link=row.querySelector<HTMLAnchorElement>('a[href*="/vp/products/"][href*="vendorItemId"]');if(!link)continue;
  const url=new URL(link.href,location.origin);const id=url.pathname.match(/products\/(\d+)/)?.[1];const vendor=url.searchParams.get("vendorItemId");if(!id||seen.has(id+"-"+vendor))continue;seen.add(id+"-"+vendor);
  const title=(row.querySelector<HTMLImageElement>("img[alt]")?.alt||row.querySelector<HTMLElement>('[class*="ProductUnit_productName"]')?.innerText||link.innerText.split("\n")[0]||"").trim();
  const priceArea=row.querySelector<HTMLElement>('[class*="PriceArea_priceArea"]')?.innerText||"";const priceMatches=priceArea.replace(/\([^)]*\)/g,"").match(/\d{1,3}(?:,\d{3})+원/g)||[];const price=won(priceMatches.at(-1)||"");
  const ratingText=row.querySelector<HTMLElement>('[class*="ProductRating_productRating"]')?.getAttribute("aria-label")||"";const reviewText=row.querySelector<HTMLElement>('[class*="ProductRating_productRating"]')?.innerText||"";
  results.push({id:id+"-"+(vendor||""),productId:id,vendorItemId:vendor,itemId:url.searchParams.get("itemId"),title,currentPrice:price,unitsPerPackage:parseUnitsPerPackage(title),productUrl:url.href,imageUrl:row.querySelector<HTMLImageElement>("img")?.src||null,rocketDelivery:/로켓|오늘|내일/.test(row.innerText),rating:Number(ratingText.replace(/[^0-9.]/g,""))||null,reviewCount:Number(reviewText.replace(/[^0-9]/g,""))||null,advertised:/광고|Ad information/.test(row.innerText),source:"BROWSER"});if(results.length>=8)break;
 }
 return results;
}
chrome.runtime.onMessage.addListener((message,_sender,respond)=>{
 if(message?.type==="DDAKDAMA_SEARCH_RESULTS")respond({results:searchResults()});
 if(message?.type==="DDAKDAMA_INSPECT_PRODUCT")respond(detail());
 if(message?.type==="DDAKDAMA_CART_SNAPSHOT")respond({items:cart()});
 if(message?.type==="DDAKDAMA_ADD_TO_CART"){
  const info=detail();if(info.securityRequired){respond({ok:false,reason:"SECURITY_CHECK_REQUIRED"});return}if(info.loginRequired){respond({ok:false,reason:"LOGIN_REQUIRED"});return}if(!info.canAdd){respond({ok:false,reason:info.optionRequired?"OPTION_REQUIRED":"ADD_BUTTON_NOT_FOUND"});return}
  const button=[...document.querySelectorAll<HTMLButtonElement>("button")].find(candidate=>/장바구니/.test(candidate.innerText)&&!candidate.disabled);button?.click();respond({ok:true,productId:info.productId,vendorItemId:info.vendorItemId});
 }
 return true;
});
