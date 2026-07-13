type CartSnapshot={productId:string;quantity:number;price:number|null;title:string};
const won=(text:string)=>{const n=Number(text.replace(/[^0-9]/g,""));return Number.isFinite(n)&&n>0?n:null};
const productId=()=>location.pathname.match(/products\/(\d+)/)?.[1]??null;
function detail(){
 const title=document.querySelector<HTMLElement>(".prod-buy-header__title,[data-testid='product-title'],h1")?.innerText.trim()??"";
 const priceText=document.querySelector<HTMLElement>(".total-price strong,.prod-sale-price .total-price,[data-testid='price']")?.innerText??"";
 const add=[...document.querySelectorAll<HTMLButtonElement>("button")].find(b=>/장바구니/.test(b.innerText)&&!b.disabled);
 const optionRequired=[...document.querySelectorAll("select,[role='combobox']")].some(el=>!(el as HTMLSelectElement).value);
 return{productId:productId(),title,price:won(priceText),inStock:!!add,optionRequired,canAdd:!!add&&!optionRequired};
}
function cart():CartSnapshot[]{
 return[...document.querySelectorAll<HTMLElement>("[data-product-id],.cart-deal-item")].map(row=>({productId:row.dataset.productId??row.getAttribute("data-product-id")??"",title:row.querySelector<HTMLElement>(".product-name,a")?.innerText.trim()??"",quantity:Number((row.querySelector<HTMLInputElement>("input[type='number']")?.value)??1),price:won(row.querySelector<HTMLElement>(".price-value,.unit-price-area")?.innerText??"")})).filter(x=>x.productId);
}
function searchResults(){
 const rows=[...document.querySelectorAll<HTMLAnchorElement>('a[href*="/vp/products/"][href*="vendorItemId"]')].map(link=>link.closest<HTMLElement>("li")).filter((row):row is HTMLElement=>Boolean(row&&!row.classList.contains("recently-viewed-item")));
 const seen=new Set<string>();const results=[];
 for(const row of rows){
  const link=row.querySelector<HTMLAnchorElement>('a[href*="/vp/products/"][href*="vendorItemId"]');if(!link)continue;
  const url=new URL(link.href,location.origin);const id=url.pathname.match(/products\/(\d+)/)?.[1];const vendor=url.searchParams.get("vendorItemId");
  if(!id||seen.has(id+"-"+vendor))continue;seen.add(id+"-"+vendor);
  const title=(row.querySelector<HTMLImageElement>("img[alt]")?.alt||row.querySelector<HTMLElement>('[class*="ProductUnit_productName"]')?.innerText||link.innerText.split("\n")[0]||"").trim();
  const priceArea=row.querySelector<HTMLElement>('[class*="PriceArea_priceArea"]')?.innerText||"";const priceMatches=priceArea.replace(/\([^)]*\)/g,"").match(/\d{1,3}(?:,\d{3})+원/g)||[];const price=won(priceMatches.at(-1)||"");
  const pack=title.match(/,\s*(\d+)\s*(?:개|병|통|세트)\s*$/u);const ratingText=row.querySelector<HTMLElement>('[class*="ProductRating_productRating"]')?.getAttribute("aria-label")||"";const reviewText=row.querySelector<HTMLElement>('[class*="ProductRating_productRating"]')?.innerText||"";
  results.push({id:id+"-"+(vendor||""),productId:id,vendorItemId:vendor,itemId:url.searchParams.get("itemId"),title,currentPrice:price,unitsPerPackage:pack?Number(pack[1]):1,productUrl:url.href,imageUrl:row.querySelector<HTMLImageElement>("img")?.src||null,rocketDelivery:/로켓|오늘|내일/.test(row.innerText),rating:Number(ratingText.replace(/[^0-9.]/g,""))||null,reviewCount:Number(reviewText.replace(/[^0-9]/g,""))||null,advertised:/광고|Ad information/.test(row.innerText),source:"BROWSER"});
  if(results.length>=8)break;
 }
 return results;
}
chrome.runtime.onMessage.addListener((message,_sender,respond)=>{
 if(message?.type==="DDAKDAMA_SEARCH_RESULTS")respond({results:searchResults()});
 if(message?.type==="DDAKDAMA_INSPECT_PRODUCT")respond(detail());
 if(message?.type==="DDAKDAMA_CART_SNAPSHOT")respond({items:cart()});
 if(message?.type==="DDAKDAMA_ADD_TO_CART"){
  const info=detail();if(!info.canAdd){respond({ok:false,reason:info.optionRequired?"OPTION_REQUIRED":"ADD_BUTTON_NOT_FOUND"});return;}
  const button=[...document.querySelectorAll<HTMLButtonElement>("button")].find(b=>/장바구니/.test(b.innerText)&&!b.disabled);button?.click();respond({ok:true,productId:info.productId});
 }
 return true;
});
