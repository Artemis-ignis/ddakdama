import{createServer}from"node:http";

const products=new Map();
const quantities=new Map();
const json=(res,status,value)=>{res.writeHead(status,{"content-type":"application/json; charset=utf-8","cache-control":"no-store"});res.end(JSON.stringify(value))};
const html=(res,value)=>{res.writeHead(200,{"content-type":"text/html; charset=utf-8","cache-control":"no-store"});res.end(value)};
const read=async req=>{const chunks=[];for await(const chunk of req)chunks.push(chunk);return JSON.parse(Buffer.concat(chunks).toString("utf8")||"{}")};
const key=product=>`${product.productId}:${product.vendorItemId}:${product.itemId}`;

createServer(async(req,res)=>{
 const url=new URL(req.url??"/","http://127.0.0.1:4174");
 if(req.method==="POST"&&url.pathname==="/fixture/configure"){
  const body=await read(req);products.clear();quantities.clear();
  for(const product of body.products??[]){products.set(String(product.productId),product);quantities.set(key(product),Number(body.quantities?.[key(product)]??0))}
  return json(res,200,{ok:true});
 }
 if(req.method==="GET"&&url.pathname==="/fixture/state")return json(res,200,{quantities:Object.fromEntries(quantities)});
 if(req.method==="GET"&&url.pathname==="/search"){const query=url.searchParams.get("q")??"";const product=[...products.values()].find(item=>query.includes(item.query??String(item.title).split(/\s+/u)[0]));if(!product)return html(res,"<!doctype html><html><body><p>검색 결과 없음</p></body></html>");return html(res,`<!doctype html><html><head><meta charset="utf-8"></head><body><ul><li class="ProductUnit_productUnit__live"><a href="https://www.coupang.com/vp/products/${product.productId}?itemId=${product.itemId}&vendorItemId=${product.vendorItemId}"><img alt="상품 이미지" data-src="https://example.test/${product.productId}.jpg"></a><div class="ProductUnit_productName__live">${product.title}</div><div>로켓배송</div></li></ul></body></html>`)}
 const add=url.pathname.match(/^\/fixture\/add\/(\d+)$/);
 if(req.method==="POST"&&add){const product=products.get(add[1]);if(!product)return json(res,404,{error:"not_found"});const productKey=key(product);quantities.set(productKey,(quantities.get(productKey)??0)+1);return json(res,200,{quantity:quantities.get(productKey)})}
 const productMatch=url.pathname.match(/^\/product\/(\d+)$/);
 if(req.method==="GET"&&productMatch){const product=products.get(productMatch[1]);if(!product)return json(res,404,{error:"not_found"});const priceMarkup=product.price?`<div class="price-container"><div class="final-price"><div class="price-amount final-price-amount">${Number(product.price).toLocaleString()}원</div></div></div>`:"";const delayedPrice=product.delayedPriceMs&&priceMarkup?`<div id="delayed-price"></div><script>setTimeout(()=>{document.querySelector('#delayed-price').innerHTML=${JSON.stringify(priceMarkup)}},${Number(product.delayedPriceMs)})</script>`:priceMarkup;const option=product.optionRequired?'<select aria-label="필수 옵션"><option value="">선택</option><option value="one">기본</option></select>':"";const buttonMarkup=`<button onclick="const request=new XMLHttpRequest();request.open('POST','/fixture/add/${product.productId}',false);request.send()">장바구니 담기</button>`;const delayedButton=product.delayedButtonMs?`<div id="delayed-button"></div><script>setTimeout(()=>{document.querySelector('#delayed-button').innerHTML=${JSON.stringify(buttonMarkup)}},${Number(product.delayedButtonMs)})</script>`:buttonMarkup;return html(res,`<!doctype html><html><head><meta charset="utf-8"></head><body data-product-id="${product.productId}" data-vendor-item-id="${product.vendorItemId}" data-item-id="${product.itemId}"><header><select aria-label="검색 카테고리"><option value="">전체</option></select></header><div class="prod-atf"><h1>${product.title}</h1>${delayedPrice}${option}${delayedButton}</div><section class="related-products"><div class="price-amount final-price-amount">999원</div></section></body></html>`)}
 if(req.method==="GET"&&url.pathname==="/cart"){const rows=[...products.values()].flatMap(product=>{const quantity=quantities.get(key(product))??0;if(!quantity)return[];return[`<div class="cart-deal-item" data-line-total="${(product.price??0)*quantity}"><a class="product-name" href="https://www.coupang.com/vp/products/${product.productId}?itemId=${product.itemId}&vendorItemId=${product.vendorItemId}">${product.title}</a><input type="number" value="${quantity}"><span class="price-value">${(product.price??0)*quantity}원</span></div>`]});return html(res,`<!doctype html><html><head><meta charset="utf-8"></head><body>${rows.join("")}</body></html>`)}
 if(req.method==="GET"&&url.pathname==="/health")return json(res,200,{ok:true});
 res.writeHead(404).end("Not Found");
}).listen(4174,"127.0.0.1",()=>console.log("cart fixture: http://127.0.0.1:4174"));
