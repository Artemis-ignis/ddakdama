import React from "react";
import{createRoot}from"react-dom/client";
import{parseShoppingList}from"@ddakdama/core";
import{App,type PreviewState,type SearchGroup}from"../src/ui/App";
import"../src/ui/styles.css";
import"../src/ui/runtime.css";

const sample=`닥터지 레드 블레미쉬 포 맨 진정 올인원 150ml
스킨1004 히알루 시카 워터핏 선 세럼 50ml 2개
라운드랩 1025 독도 클렌저 150ml 2개
TS 골드플러스 샴푸 500g
닥터스베스트 고흡수 마그네슘 100mg 240정`;
const lines=parseShoppingList(sample);
const prices=[16200,10900,9450,11540,26450];
const groups:SearchGroup[]=lines.map((line,index)=>({requestLineId:line.id,results:[
 {id:`${index}-best`,productId:`1000${index}`,vendorItemId:`2000${index}`,itemId:null,title:`${line.productName} ${line.unitSizeValue??line.strengthValue}${line.unitSizeUnit??line.strengthUnit}${line.packageContentCount?` ${line.packageContentCount}${line.packageContentUnit}`:""}`,currentPrice:prices[index],unitsPerPackage:index===1||index===2?2:1,productUrl:`https://www.coupang.com/vp/products/1000${index}?vendorItemId=2000${index}`,imageUrl:null,rocketDelivery:true,rating:4.8,reviewCount:1200,advertised:false,source:"BROWSER"},
 {id:`${index}-single`,productId:`3000${index}`,vendorItemId:`4000${index}`,itemId:null,title:`${line.productName} 단품`,currentPrice:Math.round(prices[index]*.58),unitsPerPackage:1,productUrl:`https://www.coupang.com/vp/products/3000${index}?vendorItemId=4000${index}`,imageUrl:null,rocketDelivery:false,rating:4.6,reviewCount:430,advertised:false,source:"BROWSER"},
]}));
const success=lines.map(line=>({id:line.id,status:"SUCCESS"}));
const partial=lines.map((line,index)=>({id:line.id,status:index===4?"PRICE_UNVERIFIED":"SUCCESS"}));
const path=location.pathname;
const preview:PreviewState=path.includes("result-partial-failure")?{groups,step:4,preflight:true,cartResults:partial,notice:"성공 4종 · 실패 1종입니다. 실패 상품을 확인해 주세요."}:path.includes("result-success")?{groups,step:4,preflight:true,cartResults:success,notice:"요청한 상품 5종을 모두 검증해 담았습니다."}:path.includes("preflight")?{groups,step:3,preflight:true,notice:"상품 5종 · 실물 7개 · 예상 금액을 확인해 주세요."}:path.includes("candidates")?{groups,step:2,notice:"모든 상품의 실제 후보를 찾았습니다."}:{};

const storage=new Map<string,unknown>();
(globalThis as typeof globalThis&{chrome:unknown}).chrome={runtime:{sendMessage:async(message:{type:string})=>message.type==="DDAKDAMA_SEARCH_ALL"?{output:groups}:message.type==="DDAKDAMA_RUN_CART_JOBS"?{results:success}:{ok:true}},storage:{local:{get:async(keys:string[])=>Object.fromEntries(keys.map(key=>[key,storage.get(key)])),set:async(values:Record<string,unknown>)=>{for(const[key,value]of Object.entries(values))storage.set(key,value)}}},tabs:{create:async()=>({})}};
createRoot(document.getElementById("root")!).render(<React.StrictMode><App preview={preview}/></React.StrictMode>);
