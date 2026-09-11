import{createServer}from"node:http";

const products=new Map();
const quantities=new Map();
let searchOptions={};
let searchRequests=[];
const escapeHtml=value=>String(value).replaceAll('&','&amp;').replaceAll('"','&quot;').replaceAll('<','&lt;').replaceAll('>','&gt;');
const searchForm=query=>`<form action="/search" style="display:none"><input name="q" value="hidden decoy"></form><form action="/search" onsubmit="event.preventDefault();this.elements.channel.value='SHOP_FORM';setTimeout(()=>HTMLFormElement.prototype.submit.call(this),${Number(searchOptions.navigationDelayMs??0)})"><input name="q" title="쿠팡 상품 검색" value="${escapeHtml(query)}"><input type="hidden" name="channel"><button type="submit" title="검색">검색</button></form>`;
const searchPage=(query,body)=>`<!doctype html><html><head><meta charset="utf-8"><title>쿠팡</title></head><body>${searchForm(query)}${body}<script>document.documentElement.dataset.ddakdamaContentReady='1'</script></body></html>`;
const json=(res,status,value)=>{res.writeHead(status,{"content-type":"application/json; charset=utf-8","cache-control":"no-store"});res.end(JSON.stringify(value))};
const html=(res,value)=>{res.writeHead(200,{"content-type":"text/html; charset=utf-8","cache-control":"no-store"});res.end(value)};
const read=async req=>{const chunks=[];for await(const chunk of req)chunks.push(chunk);return JSON.parse(Buffer.concat(chunks).toString("utf8")||"{}")};
const key=product=>`${product.productId}:${product.vendorItemId}:${product.itemId}`;

createServer(async(req,res)=>{
 const url=new URL(req.url??"/","http://127.0.0.1:4174");
 if(req.method==="POST"&&url.pathname==="/fixture/configure"){
  const body=await read(req);products.clear();quantities.clear();searchOptions=body.searchOptions??{};searchRequests=[];
  for(const product of body.products??[]){products.set(String(product.productId),product);quantities.set(key(product),Number(body.quantities?.[key(product)]??0))}
  return json(res,200,{ok:true});
 }
 if(req.method==="GET"&&url.pathname==="/fixture/state")return json(res,200,{quantities:Object.fromEntries(quantities),searchRequests});
 if(req.method==="GET"&&url.pathname==="/")return html(res,searchPage("","<h1>쇼핑 홈</h1>"));
 if(req.method==="GET"&&url.pathname==="/search"){
  const query=url.searchParams.get("q")??"";const channel=url.searchParams.get("channel");searchRequests.push({query,channel});
  if(searchOptions.blocked||(searchOptions.requireForm&&channel!=="SHOP_FORM"))return html(res,'<!doctype html><html><head><meta charset="utf-8"><title>쿠팡</title></head><body><img alt="요청하신 페이지의 사용권한이 없습니다."><p>쿠팡 홈에서 확인해 주세요.</p></body></html>');
  const product=[...products.values()].find(item=>query.includes(item.query??String(item.title).split(/\s+/u)[0]));
  if(!product)return html(res,searchPage(query,"<p>검색 결과 없음</p>"));
  const price=searchOptions.includeSearchPrices?`<div class="PriceArea_priceArea__NntJz"><del>99,999원</del><div>${Number(product.price).toLocaleString()}원</div><span>(10ml당 1,234원)</span></div>`:"";
  const card=`<ul><li class="ProductUnit_productUnit__Qd6sv"><a href="https://www.coupang.com/vp/products/${product.productId}?itemId=${product.itemId}&vendorItemId=${product.vendorItemId}"><img alt="${escapeHtml(product.title)}" data-src="https://example.test/${product.productId}.jpg"><div class="ProductUnit_productNameV2__cV9cw">${escapeHtml(product.title)}</div>${price}<div>로켓배송</div></a></li></ul>`;
  const content=searchOptions.cardsDelayMs?`<div id="results"></div><script>setTimeout(()=>{document.querySelector('#results').innerHTML=${JSON.stringify(card)}},${Number(searchOptions.cardsDelayMs)})</script>`:card;
  return html(res,searchPage(query,content));
 }
 const add=url.pathname.match(/^\/fixture\/add\/(\d+)$/);
 if(req.method==="POST"&&add){const product=products.get(add[1]);if(!product)return json(res,404,{error:"not_found"});const productKey=key(product);quantities.set(productKey,(quantities.get(productKey)??0)+1);return json(res,200,{quantity:quantities.get(productKey)})}
 const productMatch=url.pathname.match(/^\/product\/(\d+)$/);
 if(req.method==="GET"&&productMatch){const product=products.get(productMatch[1]);if(!product)return json(res,404,{error:"not_found"});const priceMarkup=product.price?`<div class="price-container"><div class="final-price"><div class="price-amount final-price-amount">${Number(product.price).toLocaleString()}원</div></div></div>`:"";const delayedPrice=product.delayedPriceMs&&priceMarkup?`<div id="delayed-price"></div><script>setTimeout(()=>{document.querySelector('#delayed-price').innerHTML=${JSON.stringify(priceMarkup)}},${Number(product.delayedPriceMs)})</script>`:priceMarkup;const option=product.optionRequired?'<select aria-label="필수 옵션"><option value="">선택</option><option value="one">기본</option></select>':"";const buttonMarkup=`<button onclick="const request=new XMLHttpRequest();request.open('POST','/fixture/add/${product.productId}',false);request.send()">장바구니 담기</button>`;const delayedButton=product.delayedButtonMs?`<div id="delayed-button"></div><script>setTimeout(()=>{document.querySelector('#delayed-button').innerHTML=${JSON.stringify(buttonMarkup)}},${Number(product.delayedButtonMs)})</script>`:buttonMarkup;return html(res,`<!doctype html><html><head><meta charset="utf-8"></head><body data-product-id="${product.productId}" data-vendor-item-id="${product.vendorItemId}" data-item-id="${product.itemId}"><header><select aria-label="검색 카테고리"><option value="">전체</option></select></header><div class="prod-atf"><h1>${product.detailTitle??product.title}</h1>${delayedPrice}${option}${delayedButton}</div><section class="related-products"><div class="price-amount final-price-amount">999원</div></section></body></html>`)}
 if(req.method==="GET"&&url.pathname==="/cart"){const rows=[...products.values()].flatMap(product=>{const quantity=quantities.get(key(product))??0;if(!quantity)return[];const identifiers=product.cartOmitsIdentifiers?"":` data-vid="${product.vendorItemId}"`;const query=product.cartOmitsIdentifiers?"sourceType=CART":`vendorItemId=${product.vendorItemId}&sourceType=CART`;const lineTotal=(product.price??0)*quantity;const lineTotalAttribute=product.cartNoisyLineTotal?"":` data-line-total="${lineTotal}"`;const priceMarkup=product.cartNoisyLineTotal?`<div class="cart-deal-item__total-price"><strong>${lineTotal.toLocaleString()}원</strong><span> · 적립 1,501원 · 주문번호 5023200047168</span></div>`:`<span>${lineTotal}원</span>`;return[`<div class="cart-deal-item" id="item_${product.productId}"${identifiers}${lineTotalAttribute}><a href="https://www.coupang.com/vp/products/${product.productId}?${query}">${product.title}</a><input class="cart-quantity-input" type="text" value="${quantity}">${priceMarkup}</div>`]});return html(res,`<!doctype html><html><head><meta charset="utf-8"></head><body>${rows.join("")}</body></html>`)}
 if(req.method==="GET"&&url.pathname==="/health")return json(res,200,{ok:true});
 res.writeHead(404).end("Not Found");
}).listen(4174,"127.0.0.1",()=>console.log("cart fixture: http://127.0.0.1:4174"));
