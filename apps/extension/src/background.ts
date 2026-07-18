import{planCartResume,type CartCheckpoint}from"./cart-journal";
import{isPlausibleCartLineTotal}from"./coupang-price";
import{detailStatus,productMismatchReasons,validateProductUrl,type ProductDetail,type ProductMismatchReason}from"./product-validation";
import{SERVER_ORIGIN as serverOrigin}from"./config";

chrome.runtime.onInstalled.addListener(()=>chrome.sidePanel.setPanelBehavior({openPanelOnActionClick:true}));
type Job={id:string;productUrl:string;navigationUrl?:string;productId:string;vendorItemId:string|null;itemId:string|null;cartPurchaseQuantity:number;expectedBrand:string|null;expectedProductName:string;expectedUnitsPerPackage:number;expectedUnitSize:string|null;expectedStrength:string|null;expectedPackageContent:string|null;status:string};
type JobResult=Job&{status:string;beforeQuantity?:number;afterQuantity?:number;verifiedPrice?:number;beforeCartPrice?:number;cartPrice?:number;expectedSubtotal?:number;cartAddedSubtotal?:number;priceDifference?:number;mismatchReasons?:ProductMismatchReason[]};
type Journal={runId:string;jobs:Job[];results:JobResult[];checkpoints:Record<string,CartCheckpoint>;startedAt:number;updatedAt:number};
const journalKey="ddakdama-cart-journal";
const affiliateEnabled=import.meta.env.VITE_DDAKDAMA_AFFILIATE_ENABLED==="true";
const cartUrl=import.meta.env.VITE_DDAKDAMA_CART_URL||"https://cart.coupang.com/cartView.pang";
const searchBaseUrl=import.meta.env.VITE_DDAKDAMA_SEARCH_BASE_URL||"https://www.coupang.com/np/search";
const validJob=(job:unknown):job is Job=>{const value=job as Partial<Job>;return Boolean(value&&typeof value.id==="string"&&value.id.length<=100&&typeof value.productUrl==="string"&&value.productUrl.length<=2000&&typeof value.productId==="string"&&/^\d+$/.test(value.productId)&&typeof value.expectedProductName==="string"&&value.expectedProductName.length>0&&value.expectedProductName.length<=300&&(value.expectedBrand===null||typeof value.expectedBrand==="string")&&Number.isInteger(value.cartPurchaseQuantity)&&Number(value.cartPurchaseQuantity)>=1&&Number(value.cartPurchaseQuantity)<=20&&Number.isInteger(value.expectedUnitsPerPackage)&&Number(value.expectedUnitsPerPackage)>=1&&Number(value.expectedUnitsPerPackage)<=20)};
const validJobs=(jobs:unknown):jobs is Job[]=>Array.isArray(jobs)&&jobs.length>0&&jobs.length<=50&&jobs.every(validJob);

async function sendToTab(tabId:number,message:unknown){let lastError:unknown;for(let attempt=0;attempt<3;attempt+=1){try{return await chrome.tabs.sendMessage(tabId,message)}catch(error){lastError=error;if(attempt<2)await new Promise(resolve=>setTimeout(resolve,200*(attempt+1)))}}throw lastError instanceof Error?lastError:new Error("CONTENT_SCRIPT_UNAVAILABLE")}
async function waitComplete(tabId:number){for(let attempt=0;attempt<150;attempt+=1){const current=await chrome.tabs.get(tabId);if(current.status==="complete")return;await new Promise(resolve=>setTimeout(resolve,100))}throw new Error("NETWORK_ERROR")}
async function createWorkerTab(){const tab=await chrome.tabs.create({url:"about:blank",active:false});if(!tab.id)throw new Error("WORKER_TAB_FAILED");return tab.id}
async function navigateWorkerTab(tabId:number,url:string){await chrome.tabs.update(tabId,{url,active:false});await waitComplete(tabId)}
async function closeWorkerTab(tabId:number|undefined){if(tabId!==undefined)await chrome.tabs.remove(tabId).catch(()=>{})}
async function inspectProductDetail(tabId:number){let detail:ProductDetail|null=null;for(let attempt=0;attempt<10;attempt+=1){detail=await sendToTab(tabId,{type:"DDAKDAMA_INSPECT_PRODUCT"}) as ProductDetail;if(detail.securityRequired||detail.loginRequired||(detail.price!==null&&(detail.inStock||detail.optionRequired)))return detail;if(attempt<9)await new Promise(resolve=>setTimeout(resolve,200))}if(!detail)throw new Error("PRODUCT_DETAIL_UNAVAILABLE");return detail}
async function cartSnapshot(tabId:number){const current=await chrome.tabs.get(tabId);if(current.url?.startsWith(cartUrl)){await chrome.tabs.reload(tabId);await waitComplete(tabId)}else await navigateWorkerTab(tabId,cartUrl);return await sendToTab(tabId,{type:"DDAKDAMA_CART_SNAPSHOT"})}
type SnapshotItem={productId:string;vendorItemId:string|null;itemId:string|null;quantity:number;price:number|null;priceIsLineTotal?:boolean};
const itemOf=(snapshot:{items?:SnapshotItem[]},job:Job)=>{
 const productItems=snapshot.items?.filter(item=>item.productId===job.productId)??[];
 if(!productItems.length)return undefined;
 const exactVendor=job.vendorItemId?productItems.find(item=>item.vendorItemId===job.vendorItemId&&(!job.itemId||!item.itemId||item.itemId===job.itemId)):undefined;
 if(exactVendor)return exactVendor;
 const identifiedItems=productItems.filter(item=>item.vendorItemId||item.itemId);
 if(job.vendorItemId&&identifiedItems.some(item=>item.vendorItemId)&&!exactVendor)return undefined;
 const exactItem=job.itemId?productItems.find(item=>item.itemId===job.itemId):undefined;
 if(exactItem)return exactItem;
 return productItems.length===1?productItems[0]:undefined;
};
const quantityOf=(snapshot:{items?:SnapshotItem[]},job:Job)=>itemOf(snapshot,job)?.quantity??0;
async function inspectJob(job:Job,tabId:number){if(!validateProductUrl(job))return{...job,status:"PRODUCT_MISMATCH",mismatchReasons:["PRODUCT_URL"] as ProductMismatchReason[]};await navigateWorkerTab(tabId,job.navigationUrl??job.productUrl);const detail=await inspectProductDetail(tabId);const status=detailStatus(job,detail);return{...job,status,verifiedPrice:detail.price,verifiedTitle:detail.title,mismatchReasons:status==="PRODUCT_MISMATCH"?productMismatchReasons(job,detail):undefined}}
async function waitForQuantity(job:Job,minimum:number,cartTabId:number){for(let attempt=0;attempt<4;attempt++){const quantity=quantityOf(await cartSnapshot(cartTabId),job);if(quantity>=minimum)return quantity;await new Promise(resolve=>setTimeout(resolve,350))}return quantityOf(await cartSnapshot(cartTabId),job)}

async function runJob(job:Job,checkpoint:CartCheckpoint|undefined,persist:(value:CartCheckpoint)=>Promise<void>,productTabId:number,cartTabId:number){
 const initialSnapshot=await cartSnapshot(cartTabId);const initialItem=itemOf(initialSnapshot,job);const current=initialItem?.quantity??0;const rawBeforeCartPrice=initialItem?.priceIsLineTotal?initialItem.price??0:undefined;
 const resume=planCartResume(current,job.cartPurchaseQuantity,checkpoint);
 const nextCheckpoint:CartCheckpoint={jobId:job.id,beforeQuantity:resume.beforeQuantity,targetQuantity:resume.targetQuantity,updatedAt:Date.now()};
 await persist(nextCheckpoint);
 await navigateWorkerTab(productTabId,job.navigationUrl??job.productUrl);const detail=await inspectProductDetail(productTabId);const status=detailStatus(job,detail);if(status!=="READY")return{...job,status,mismatchReasons:status==="PRODUCT_MISMATCH"?productMismatchReasons(job,detail):undefined};
 let observed=current;for(let i=0;i<resume.remainingQuantity;i++){const expectedAfterClick=current+i+1;const added=await sendToTab(productTabId,{type:"DDAKDAMA_ADD_TO_CART"});if(!added.ok)return{...job,status:added.reason??"ADD_BUTTON_NOT_FOUND"};observed=await waitForQuantity(job,expectedAfterClick,cartTabId);if(observed<expectedAfterClick)return{...job,status:"CART_VERIFICATION_FAILED"}}
 const finalSnapshot=await cartSnapshot(cartTabId);const finalItem=itemOf(finalSnapshot,job);const after=finalItem?.quantity??0;const rawCartPrice=finalItem?.price??undefined;const addedQuantity=Math.max(0,after-resume.beforeQuantity);const expectedSubtotal=detail.price?detail.price*addedQuantity:undefined;
 const beforeCartPrice=current===0?0:isPlausibleCartLineTotal(rawBeforeCartPrice,detail.price,current)?rawBeforeCartPrice:undefined;
 const cartPrice=isPlausibleCartLineTotal(rawCartPrice,detail.price,after)?rawCartPrice:undefined;
 const cartAddedSubtotal=finalItem?.priceIsLineTotal&&cartPrice!==undefined&&beforeCartPrice!==undefined?Math.max(0,cartPrice-beforeCartPrice):undefined;const priceDifference=cartAddedSubtotal!==undefined&&expectedSubtotal!==undefined?cartAddedSubtotal-expectedSubtotal:undefined;
 return{...job,status:after===resume.targetQuantity?"SUCCESS":"QUANTITY_MISMATCH",beforeQuantity:resume.beforeQuantity,afterQuantity:after,verifiedTitle:detail.title,verifiedPrice:detail.price??undefined,beforeCartPrice,cartPrice,expectedSubtotal,cartAddedSubtotal,priceDifference};
}
async function runCartJobs(runId:string,jobs:Job[]){
 const stored=await chrome.storage.local.get(journalKey);const previous=stored[journalKey] as Journal|undefined;
 const journal:Journal=previous?.runId===runId?previous:{runId,jobs,results:[],checkpoints:{},startedAt:Date.now(),updatedAt:Date.now()};
 const pendingJobs=jobs.filter(job=>!journal.results.some(result=>result.id===job.id&&result.status==="SUCCESS"));if(!pendingJobs.length)return journal.results;
 let productTabId:number|undefined;let cartTabId:number|undefined;
 try{productTabId=await createWorkerTab();cartTabId=await createWorkerTab();for(const job of pendingJobs){
   const result=await runJob(job,journal.checkpoints[job.id],async checkpoint=>{journal.checkpoints[job.id]=checkpoint;journal.updatedAt=Date.now();await chrome.storage.local.set({[journalKey]:journal})},productTabId,cartTabId).catch(error=>({...job,status:error instanceof Error?error.message:"UNKNOWN_ERROR"}));
   journal.results=journal.results.filter(previousResult=>previousResult.id!==job.id);journal.results.push(result);journal.updatedAt=Date.now();await chrome.storage.local.set({[journalKey]:journal});
  }}finally{await closeWorkerTab(productTabId);await closeWorkerTab(cartTabId)}
 return journal.results;
}
async function recoverableJournal(){
 const stored=await chrome.storage.local.get(journalKey);const journal=stored[journalKey] as Journal|undefined;
 if(!journal||!validJobs(journal.jobs)||journal.jobs.every(job=>journal.results.some(result=>result.id===job.id&&result.status==="SUCCESS")))return null;
 return journal;
}
const testNavigationCandidate=(candidate:{productId?:string;vendorItemId?:string|null;itemId?:string|null})=>{
 if(import.meta.env.MODE!=="test")return candidate;
 const base=new URL(searchBaseUrl);
 if(base.hostname!=="127.0.0.1"&&base.hostname!=="localhost")return candidate;
 const target=new URL(`/product/${candidate.productId??""}`,base);
 if(candidate.vendorItemId)target.searchParams.set("vendorItemId",candidate.vendorItemId);
 if(candidate.itemId)target.searchParams.set("itemId",candidate.itemId);
 return{...candidate,navigationUrl:target.href};
};
async function searchOne(query:string,tabId:number){const url=new URL(searchBaseUrl);url.searchParams.set("q",query);await navigateWorkerTab(tabId,url.href);let lastResults:unknown[]=[];let pageHadProducts=false;for(let attempt=0;attempt<12;attempt+=1){const value=await sendToTab(tabId,{type:"DDAKDAMA_SEARCH_RESULTS"});if(value?.securityRequired)throw new Error("SECURITY_CHECK_REQUIRED");if(value?.loginRequired)throw new Error("LOGIN_REQUIRED");const results=Array.isArray(value?.results)?value.results.map(testNavigationCandidate):[];if(results.length){lastResults=results;if(results.some((candidate:{currentPrice?:number|null})=>Number(candidate.currentPrice)>0)||attempt>=6)return results}pageHadProducts=pageHadProducts||Number(value?.productLinkCount)>0;if(attempt<11)await new Promise(resolve=>setTimeout(resolve,150))}if(lastResults.length)return lastResults;throw new Error(pageHadProducts?"DOM_PARSE_FAILED":"NO_RESULTS")}
async function openCart(){const tabs=await chrome.tabs.query({});const existing=tabs.find(tab=>tab.url?.startsWith(cartUrl));if(existing?.id){await chrome.tabs.update(existing.id,{active:true});return existing.id}const created=await chrome.tabs.create({url:cartUrl,active:true});return created.id}
async function deviceToken(){
 const stored=await chrome.storage.local.get("ddakdama-device-token");const existing=String(stored["ddakdama-device-token"]??"");if(existing)return existing;
 try{const response=await fetch(`${serverOrigin}/api/pairing/start`,{method:"POST",headers:{"content-type":"application/json"},body:"{}"});if(!response.ok)return"";const data=await response.json() as{deviceId?:string;deviceToken?:string};if(!data.deviceToken)return"";await chrome.storage.local.set({"ddakdama-device-id":data.deviceId??"","ddakdama-device-token":data.deviceToken});return data.deviceToken}catch{return""}
}
async function partnerSearch(query:string){if(!affiliateEnabled)return[];const token=await deviceToken();if(!token)return[];try{const response=await fetch(`${serverOrigin}/api/affiliate/search`,{method:"POST",headers:{authorization:`Bearer ${token}`,"content-type":"application/json"},body:JSON.stringify({keyword:query,limit:8})});if(!response.ok)return[];return(await response.json()).results??[]}catch{return[]}}
async function applyAffiliateLinks(jobs:Job[]){if(!affiliateEnabled)return jobs;const token=await deviceToken();if(!token)return jobs;try{const response=await fetch(`${serverOrigin}/api/affiliate/deeplink`,{method:"POST",headers:{authorization:`Bearer ${token}`,"content-type":"application/json"},body:JSON.stringify({urls:jobs.map(job=>job.productUrl)})});if(!response.ok)return jobs;const links=(await response.json()).links??[];return jobs.map(job=>({...job,navigationUrl:links.find((link:{originalUrl:string})=>link.originalUrl===job.productUrl)?.landingUrl??job.productUrl}))}catch{return jobs}}

chrome.runtime.onMessage.addListener((message,_sender,sendResponse)=>{
 if(message?.type==="DDAKDAMA_PING"){sendResponse({ok:true,name:"ddakdama",version:chrome.runtime.getManifest().version,affiliateEnabled});return false}
 if(message?.type==="DDAKDAMA_GET_CART_JOURNAL"){recoverableJournal().then(journal=>sendResponse({ok:true,journal}));return true}
 if(message?.type==="DDAKDAMA_RESUME_CART_JOURNAL"){recoverableJournal().then(journal=>journal?runCartJobs(journal.runId,journal.jobs).then(results=>sendResponse({ok:true,results,journal:null})):sendResponse({ok:false,error:"NO_RECOVERABLE_JOURNAL",results:[]}));return true}
 if(message?.type==="DDAKDAMA_CLEAR_CART_JOURNAL"){chrome.storage.local.remove(journalKey).then(()=>sendResponse({ok:true}));return true}
 if(message?.type==="DDAKDAMA_OPEN_CART"){openCart().then(tabId=>sendResponse({ok:true,tabId})).catch(error=>sendResponse({ok:false,error:error instanceof Error?error.message:"OPEN_CART_FAILED"}));return true}
 if(message?.type==="DDAKDAMA_PREFLIGHT"){if(!validJobs(message.jobs)){sendResponse({ok:false,error:"INVALID_JOBS",results:[]});return false}(async()=>{let tabId:number|undefined;try{tabId=await createWorkerTab();const results=[];for(const job of message.jobs)results.push(await inspectJob(job,tabId).catch(error=>({...job,status:error instanceof Error?error.message:"UNKNOWN_ERROR"})));sendResponse({ok:true,results})}finally{await closeWorkerTab(tabId)}})().catch(error=>sendResponse({ok:false,error:error instanceof Error?error.message:"PREFLIGHT_FAILED",results:[]}));return true}
 if(message?.type==="DDAKDAMA_RUN_CART_JOBS"){if(!validJobs(message.jobs)){sendResponse({ok:false,error:"INVALID_JOBS",results:[]});return false}applyAffiliateLinks(message.jobs).then(jobs=>runCartJobs(String(message.runId??crypto.randomUUID()),jobs)).then(results=>sendResponse({ok:true,results}));return true}
 if(message?.type==="DDAKDAMA_SEARCH_ALL"){if(!Array.isArray(message.items)||message.items.length<1||message.items.length>50){sendResponse({ok:false,error:"INVALID_ITEMS",output:[]});return false}(async()=>{let tabId:number|undefined;try{tabId=await createWorkerTab();const output=[];for(const item of message.items){if(typeof item.rawText!=="string"||item.rawText.length>500){output.push({requestLineId:String(item.id??""),results:[],error:"INVALID_ITEM"});continue}const partner=await partnerSearch(item.rawText);let browser=[];let browserError="";try{browser=await searchOne(item.rawText,tabId)}catch(error){browserError=error instanceof Error?error.message:"SEARCH_FAILED"}const results=[...partner,...browser].filter((candidate,index,all)=>all.findIndex(other=>other.productId===candidate.productId&&other.vendorItemId===candidate.vendorItemId)===index);output.push({requestLineId:item.id,results,error:results.length?undefined:browserError||"NO_RESULTS"})}sendResponse({ok:true,output})}finally{await closeWorkerTab(tabId)}})().catch(error=>sendResponse({ok:false,error:error instanceof Error?error.message:"SEARCH_FAILED",output:[]}));return true}
 return false;
});
