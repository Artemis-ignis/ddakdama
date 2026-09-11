import{planCartResume,type CartCheckpoint}from"./cart-journal";
import{isPlausibleCartLineTotal}from"./coupang-price";
import{detailStatus,productMismatchReasons,validateProductUrl,type ProductDetail,type ProductMismatchReason}from"./product-validation";
import{SERVER_ORIGIN as serverOrigin}from"./config";
import{isTrustedPlanLink}from"./config";
import{searchQueryPlanFromRawText}from"./search-query";
import{shortlistSearchCandidates,type CandidateForSelection}from"./candidate-selection";

chrome.runtime.onInstalled.addListener(()=>chrome.sidePanel.setPanelBehavior({openPanelOnActionClick:true}));
type Job={id:string;productUrl:string;canonicalUrl?:string;affiliateUrl?:string|null;affiliateVerified?:boolean;navigationUrl?:string;productId:string;vendorItemId:string|null;itemId:string|null;cartPurchaseQuantity:number;expectedBrand:string|null;expectedProductName:string;expectedUnitsPerPackage:number;expectedUnitSize:string|null;expectedStrength:string|null;expectedPackageContent:string|null;status:string};
type JobResult=Job&{status:string;skippedExisting?:boolean;selectionWarning?:boolean;beforeQuantity?:number;afterQuantity?:number;verifiedPrice?:number;beforeCartPrice?:number;cartPrice?:number;expectedSubtotal?:number;cartAddedSubtotal?:number;priceDifference?:number;mismatchReasons?:ProductMismatchReason[]};
type Journal={runId:string;jobs:Job[];results:JobResult[];checkpoints:Record<string,CartCheckpoint>;startedAt:number;updatedAt:number};
const journalKey="ddakdama-cart-journal";
const affiliateEnabled=import.meta.env.VITE_DDAKDAMA_AFFILIATE_ENABLED==="true";
// The existing DdakDama extension supports user-started search and cart
// verification. A deployment can explicitly disable those actions with
// VITE_DDAKDAMA_REAL_COUPANG_AUTOMATION_ENABLED=false.
const cartAutomationEnabled=import.meta.env.VITE_DDAKDAMA_REAL_COUPANG_AUTOMATION_ENABLED!=="false";
const cartUrl=import.meta.env.VITE_DDAKDAMA_CART_URL||"https://cart.coupang.com/cartView.pang";
const searchBaseUrl=import.meta.env.VITE_DDAKDAMA_SEARCH_BASE_URL||"https://www.coupang.com/np/search";
const searchTraceKey="ddakdama-search-trace";
const validJob=(job:unknown):job is Job=>{const value=job as Partial<Job>;const canonical=value.canonicalUrl??value.productUrl;return Boolean(value&&typeof value.id==="string"&&value.id.length<=100&&typeof canonical==="string"&&canonical.length<=2000&&typeof value.productId==="string"&&/^\d+$/.test(value.productId)&&typeof value.expectedProductName==="string"&&value.expectedProductName.length>0&&value.expectedProductName.length<=300&&(value.expectedBrand===null||typeof value.expectedBrand==="string")&&Number.isInteger(value.cartPurchaseQuantity)&&Number(value.cartPurchaseQuantity)>=1&&Number(value.cartPurchaseQuantity)<=20&&Number.isInteger(value.expectedUnitsPerPackage)&&Number(value.expectedUnitsPerPackage)>=1&&Number(value.expectedUnitsPerPackage)<=20)};
const validJobs=(jobs:unknown):jobs is Job[]=>Array.isArray(jobs)&&jobs.length>0&&jobs.length<=50&&jobs.every(validJob);

async function pingContentScript(tabId:number){try{const response=await chrome.tabs.sendMessage(tabId,{type:"DDAKDAMA_PING_CONTENT"});return response?.ok===true}catch{return false}}
async function ensureContentScript(tabId:number){
 if(await pingContentScript(tabId))return;
 try{await chrome.scripting.executeScript({target:{tabId},files:["dist/content.js"]})}catch{throw new Error("CONTENT_SCRIPT_UNAVAILABLE")}
 for(let attempt=0;attempt<5;attempt+=1){if(await pingContentScript(tabId))return;await new Promise(resolve=>setTimeout(resolve,150*(attempt+1)))}
 throw new Error("CONTENT_SCRIPT_UNAVAILABLE");
}
async function sendToTab(tabId:number,message:unknown){let lastError:unknown;for(let attempt=0;attempt<3;attempt+=1){try{return await chrome.tabs.sendMessage(tabId,message)}catch(error){lastError=error;if(attempt===0)await ensureContentScript(tabId).catch(()=>{});if(attempt<2)await new Promise(resolve=>setTimeout(resolve,200*(attempt+1)))}}void lastError;throw new Error("CONTENT_SCRIPT_UNAVAILABLE")}
async function contentDocument(tabId:number){try{return await chrome.tabs.sendMessage(tabId,{type:"DDAKDAMA_PING_CONTENT"}) as {ok:boolean;documentId?:string;pageReady?:boolean}}catch{return null}}
async function waitForNewDocument(tabId:number,previousId?:string){
 const deadline=Date.now()+12_000;
 while(Date.now()<deadline){
  const tab=await chrome.tabs.get(tabId);
  if(tab.url?.startsWith("https://login.coupang.com/"))throw new Error("LOGIN_REQUIRED");
  if(tab.url&&tab.url!=="about:blank"){
   let document=await contentDocument(tabId);
   if(!document){await ensureContentScript(tabId).catch(()=>{});document=await contentDocument(tabId)}
   if(document?.ok&&document.documentId!==previousId&&document.pageReady)return;
  }
  await new Promise(resolve=>setTimeout(resolve,100));
 }
 throw new Error("NETWORK_ERROR");
}
async function createWorkerTab(){const tab=await chrome.tabs.create({url:"about:blank",active:false});if(!tab.id)throw new Error("WORKER_TAB_FAILED");return tab.id}
async function navigateWorkerTab(tabId:number,url:string,active=false){const previous=await contentDocument(tabId);await chrome.tabs.update(tabId,{url,active});await waitForNewDocument(tabId,previous?.documentId)}
async function closeWorkerTab(tabId:number|undefined){if(tabId!==undefined)await chrome.tabs.remove(tabId).catch(()=>{})}
async function inspectProductDetail(tabId:number){let detail:ProductDetail|null=null;for(let attempt=0;attempt<30;attempt+=1){detail=await sendToTab(tabId,{type:"DDAKDAMA_INSPECT_PRODUCT"}) as ProductDetail;if(detail.securityRequired||detail.loginRequired||detail.membershipRequired||detail.stockStatus==="OUT_OF_STOCK"||(detail.price!==null&&(detail.inStock||detail.optionRequired)))return detail;if(attempt<29)await new Promise(resolve=>setTimeout(resolve,250))}if(!detail)throw new Error("PRODUCT_DETAIL_UNAVAILABLE");return detail}
async function cartSnapshot(tabId:number){const current=await chrome.tabs.get(tabId);if(current.url?.startsWith(cartUrl)){const previous=await contentDocument(tabId);await chrome.tabs.reload(tabId);await waitForNewDocument(tabId,previous?.documentId)}else await navigateWorkerTab(tabId,cartUrl);return await sendToTab(tabId,{type:"DDAKDAMA_CART_SNAPSHOT"})}
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
const canonicalOf=(job:Job)=>job.canonicalUrl??job.productUrl;
async function inspectJob(job:Job,tabId:number){if(!validateProductUrl({...job,productUrl:canonicalOf(job)}))return{...job,status:"PRODUCT_MISMATCH",mismatchReasons:["PRODUCT_URL"] as ProductMismatchReason[]};await navigateWorkerTab(tabId,job.affiliateVerified&&job.affiliateUrl?job.affiliateUrl:job.navigationUrl??canonicalOf(job));const detail=await inspectProductDetail(tabId);const status=detailStatus(job,detail);return{...job,status,verifiedPrice:detail.price,verifiedTitle:detail.title,mismatchReasons:status==="PRODUCT_MISMATCH"?productMismatchReasons(job,detail):undefined}}
async function waitForQuantity(job:Job,minimum:number,cartTabId:number){for(let attempt=0;attempt<4;attempt++){const snapshot=await cartSnapshot(cartTabId);const quantity=quantityOf(snapshot,job);if(quantity>=minimum)return{quantity,snapshot};await new Promise(resolve=>setTimeout(resolve,350))}const snapshot=await cartSnapshot(cartTabId);return{quantity:quantityOf(snapshot,job),snapshot}}

async function runJob(job:Job,checkpoint:CartCheckpoint|undefined,persist:(value:CartCheckpoint)=>Promise<void>,productTabId:number,cartTabId:number){
 const initialSnapshot=await cartSnapshot(cartTabId);const initialItem=itemOf(initialSnapshot,job);const current=initialItem?.quantity??0;const rawBeforeCartPrice=initialItem?.priceIsLineTotal?initialItem.price??0:undefined;
 if((job as Job&{skipExisting?:boolean}).skipExisting&&initialSnapshot?.readable===false)return{...job,status:"CART_VERIFICATION_FAILED"};
 if((job as Job&{skipExisting?:boolean}).skipExisting&&!checkpoint&&current>0){
  if(!initialItem||(job.vendorItemId?initialItem.vendorItemId!==job.vendorItemId:!job.itemId||initialItem.itemId!==job.itemId))return{...job,status:"PRODUCT_MISMATCH"};
  return{...job,status:"SUCCESS",skippedExisting:true,beforeQuantity:current,afterQuantity:current,expectedSubtotal:0,cartAddedSubtotal:0};
 }
 const resume=planCartResume(current,job.cartPurchaseQuantity,checkpoint);
 const nextCheckpoint:CartCheckpoint={jobId:job.id,beforeQuantity:resume.beforeQuantity,targetQuantity:resume.targetQuantity,updatedAt:Date.now()};
 await persist(nextCheckpoint);
 await navigateWorkerTab(productTabId,job.affiliateVerified&&job.affiliateUrl?job.affiliateUrl:job.navigationUrl??canonicalOf(job));const detail=await inspectProductDetail(productTabId);const status=detailStatus(job,detail);if(status!=="READY")return{...job,status,mismatchReasons:status==="PRODUCT_MISMATCH"?productMismatchReasons(job,detail):undefined};
 let finalSnapshot=initialSnapshot;for(let i=0;i<resume.remainingQuantity;i++){const expectedAfterClick=current+i+1;const added=await sendToTab(productTabId,{type:"DDAKDAMA_ADD_TO_CART"});if(!added.ok)return{...job,status:added.reason??"ADD_BUTTON_NOT_FOUND"};const observed=await waitForQuantity(job,expectedAfterClick,cartTabId);if(observed.quantity<expectedAfterClick)return{...job,status:"CART_VERIFICATION_FAILED"};finalSnapshot=observed.snapshot}
 const finalItem=itemOf(finalSnapshot,job);const after=finalItem?.quantity??0;const rawCartPrice=finalItem?.price??undefined;const addedQuantity=Math.max(0,after-resume.beforeQuantity);const expectedSubtotal=detail.price?detail.price*addedQuantity:undefined;
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
  }
  if(jobs.some(job=>(job as Job&{selectNewOnly?:boolean}).selectNewOnly)){
   const targets=journal.results.filter(result=>result.status==="SUCCESS"&&!result.skippedExisting);
   const selected=await sendToTab(cartTabId,{type:"DDAKDAMA_SELECT_CART_ITEMS",targets}).catch(()=>({ok:false}));
   if(!selected?.ok){journal.results=journal.results.map(result=>({...result,selectionWarning:true}));await chrome.storage.local.set({[journalKey]:journal});}
  }
 }finally{await closeWorkerTab(productTabId);await closeWorkerTab(cartTabId)}
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
const searchHomeUrl=new URL("/",searchBaseUrl).href;
const searchTabKey="ddakdama-owned-search-tab";
let searchBusy=false;
const delay=(ms:number)=>new Promise(resolve=>setTimeout(resolve,ms));
const isSearchLocation=(url?:string)=>{try{const parsed=new URL(url??"");return parsed.origin===new URL(searchBaseUrl).origin&&(parsed.pathname==="/"||parsed.pathname===new URL(searchBaseUrl).pathname)}catch{return false}};
async function acquireSearchTab(){
 const stored=await chrome.storage.session.get(searchTabKey);
 const existing=typeof stored[searchTabKey]==="number"?await chrome.tabs.get(stored[searchTabKey]).catch(()=>null):null;
 // Only reuse a tab this extension created, never commandeer a user's tab.
 if(existing?.id&&isSearchLocation(existing.url)){await chrome.tabs.update(existing.id,{active:true});return existing.id}
 const id=await createWorkerTab();
 await chrome.storage.session.set({[searchTabKey]:id});
 await navigateWorkerTab(id,searchHomeUrl,true);
 return id;
}
async function releaseSearchTab(tabId:number){
 const tab=await chrome.tabs.get(tabId).catch(()=>null);
 if(tab&&isSearchLocation(tab.url))await closeWorkerTab(tabId);
 await chrome.storage.session.remove(searchTabKey);
}
async function submitShopSearch(query:string,tabId:number){
 const tab=await chrome.tabs.get(tabId);
 if(!isSearchLocation(tab.url))throw new Error("SEARCH_INTERRUPTED");
 await ensureContentScript(tabId);
 for(let attempt=0;attempt<12;attempt+=1){
  const submitted=await sendToTab(tabId,{type:"DDAKDAMA_SUBMIT_SEARCH",query});
  if(submitted?.ok)return String(submitted.documentId);
  if(submitted?.error!=="SEARCH_FORM_UNAVAILABLE")throw new Error(submitted?.error??"SEARCH_FAILED");
  await delay(250);
 }
 throw new Error("SEARCH_FORM_UNAVAILABLE");
}
async function searchOne(query:string,tabId:number){
 // A user may have completed a normal search in our retained recovery tab.
 // Read that exact query rather than sending another request over its result.
 await ensureContentScript(tabId);
 const existing=await sendToTab(tabId,{type:"DDAKDAMA_SEARCH_RESULTS"});
 if(!existing?.securityRequired&&!existing?.loginRequired&&existing?.pageReady&&existing?.query===query&&existing?.results?.length)return existing.results.map(testNavigationCandidate);
 const previousDocument=await submitShopSearch(query,tabId);
 const deadline=Date.now()+20_000;
 let resultsReadyAt=0;let pageHadProducts=false;let lastResults:unknown[]=[];
 while(Date.now()<deadline){
  await delay(200);
  const tab=await chrome.tabs.get(tabId);
  // During navigation the old document may still answer. Its results must
  // never be assigned to the next shopping-list item.
  const value=await sendToTab(tabId,{type:"DDAKDAMA_SEARCH_RESULTS"}).catch(()=>null);
  if(!value)continue;
  if(value.securityRequired)throw new Error("SECURITY_CHECK_REQUIRED");
  if(value.loginRequired)throw new Error("LOGIN_REQUIRED");
  if(!isSearchLocation(tab.url))throw new Error("SEARCH_INTERRUPTED");
  if(value.documentId===previousDocument||value.query!==query||!value.pageReady)continue;
  resultsReadyAt||=Date.now();
  const results=Array.isArray(value.results)?value.results.map(testNavigationCandidate):[];
  if(results.length){
   lastResults=results;
   if(results.some((candidate:{currentPrice?:number|null})=>Number(candidate.currentPrice)>0)||Date.now()-resultsReadyAt>=3000)return results;
  }
  pageHadProducts||=Number(value.productLinkCount)>0||Number(value.productCardCount)>0;
  if(Date.now()-resultsReadyAt>=5000)break;
 }
 if(lastResults.length)return lastResults;
 throw new Error(!resultsReadyAt?"SEARCH_TIMEOUT":pageHadProducts?"DOM_PARSE_FAILED":"NO_RESULTS");
}

async function searchBatch(items:Array<{id:string;rawText:string;productName?:string}>){
 let tabId:number|undefined;let stopReason="";
 const output=[];
 try{
  for(const item of items){
   if(stopReason){output.push({requestLineId:String(item?.id??""),results:[],error:stopReason,paused:true});continue}
   if(!item||typeof item.rawText!=="string"||item.rawText.length>500){output.push({requestLineId:String(item?.id??""),results:[],error:"INVALID_ITEM"});continue}
   let queryPlan:ReturnType<typeof searchQueriesFromItem>=[];
   try{queryPlan=searchQueriesFromItem(item)}catch{}
   if(!queryPlan.length){output.push({requestLineId:item.id,results:[],error:"INVALID_PRODUCT_NAME"});continue}
   let results:unknown[]=[];let browserError="";
   const attempts=[];
   for(const {stage,query} of queryPlan){
    const partner=await partnerSearch(query);let browser:unknown[]=[];let error="";
    if(!partner.length){
     try{tabId??=await acquireSearchTab();browser=await searchOne(query,tabId)}catch(caught){
      error=caught instanceof Error?caught.message:"SEARCH_FAILED";browserError=error;
      // Only a genuine empty results page permits a broader query. Security,
      // login and unreadable pages stop the entire batch without retry storms.
      if(error!=="NO_RESULTS"&&error!=="INVALID_QUERY")stopReason=error;
     }
    }
    attempts.push({stage,query,browserResultCount:browser.length,partnerResultCount:partner.length,error:error||undefined});
    results=[...partner,...browser];
    if(results.length||stopReason)break;
   }
   const candidates=results.filter((value):value is CandidateForSelection=>Boolean(value&&typeof (value as CandidateForSelection).title==="string"));
   const shortlisted=shortlistSearchCandidates(item.rawText,candidates);
   output.push({requestLineId:item.id,results:shortlisted,error:shortlisted.length?undefined:browserError||"NO_RESULTS",searchedQueries:attempts.map(attempt=>attempt.query)});
   await recordSearchTrace({at:Date.now(),requestLineId:item.id,attempts,totalCandidateCount:results.length}).catch(()=>{});
  }
  return{ok:true,output,recoveryTabId:stopReason?tabId:undefined};
 }finally{
  if(tabId!==undefined){if(stopReason)await chrome.tabs.update(tabId,{active:true}).catch(()=>{});else await releaseSearchTab(tabId)}
 }
}
async function openCart(){const tabs=await chrome.tabs.query({});const existing=tabs.find(tab=>tab.url?.startsWith(cartUrl));if(existing?.id){await chrome.tabs.update(existing.id,{active:true});return existing.id}const created=await chrome.tabs.create({url:cartUrl,active:true});return created.id}
async function deviceToken(){
 const stored=await chrome.storage.local.get("ddakdama-device-token");const existing=String(stored["ddakdama-device-token"]??"");if(existing)return existing;
 try{const response=await fetch(`${serverOrigin}/api/pairing/start`,{method:"POST",headers:{"content-type":"application/json"},body:"{}"});if(!response.ok)return"";const data=await response.json() as{deviceId?:string;deviceToken?:string};if(!data.deviceToken)return"";await chrome.storage.local.set({"ddakdama-device-id":data.deviceId??"","ddakdama-device-token":data.deviceToken});return data.deviceToken}catch{return""}
}
async function partnerSearch(query:string){if(!affiliateEnabled)return[];const token=await deviceToken();if(!token)return[];try{const response=await fetch(`${serverOrigin}/api/affiliate/search`,{method:"POST",headers:{authorization:`Bearer ${token}`,"content-type":"application/json"},body:JSON.stringify({keyword:query,limit:8})});if(!response.ok)return[];return(await response.json()).results??[]}catch{return[]}}
const searchQueriesFromItem=(item:{rawText:string})=>searchQueryPlanFromRawText(item.rawText);
async function recordSearchTrace(trace:unknown){const stored=await chrome.storage.local.get(searchTraceKey);const previous=Array.isArray(stored[searchTraceKey])?stored[searchTraceKey]:[];await chrome.storage.local.set({[searchTraceKey]:[...previous,trace].slice(-100)});}
async function applyAffiliateLinks(jobs:Job[]){
 if(!affiliateEnabled)return jobs;
 const token=await deviceToken();if(!token)return jobs;
 const canonicalUrls=jobs.map(canonicalOf);
 try{
  const response=await fetch(`${serverOrigin}/api/affiliate/deeplink`,{method:"POST",headers:{authorization:`Bearer ${token}`,"content-type":"application/json"},body:JSON.stringify({urls:canonicalUrls})});
  if(!response.ok)return jobs.map(job=>({...job,affiliateUrl:null,affiliateVerified:false}));
  const links=(await response.json()).links??[];
  return jobs.map(job=>{
   const canonicalUrl=canonicalOf(job);
   const link=links.find((value:{originalUrl?:string})=>value.originalUrl===canonicalUrl) as {landingUrl?:string;affiliateVerified?:boolean}|undefined;
   const verified=Boolean(link?.affiliateVerified&&link.landingUrl);
   return {...job,canonicalUrl,affiliateUrl:verified?link!.landingUrl!:null,affiliateVerified:verified,navigationUrl:verified?link!.landingUrl!:canonicalUrl};
  });
 }catch{return jobs.map(job=>({...job,canonicalUrl:canonicalOf(job),affiliateUrl:null,affiliateVerified:false,navigationUrl:canonicalOf(job)}));}
}

chrome.runtime.onMessage.addListener((message,_sender,sendResponse)=>{
 if(message?.type==="DDAKDAMA_CHECK_COUPANG_LOGIN"){
  void(async()=>{
   const tabs=(await chrome.tabs.query({url:"https://www.coupang.com/*"})).sort((a,b)=>Number(b.active)-Number(a.active));
   for(const tab of tabs){
    if(!tab.id)continue;
    try{const value=await sendToTab(tab.id,{type:"DDAKDAMA_LOGIN_STATUS"});if(value?.status==="SIGNED_IN"||value?.status==="SIGNED_OUT"){sendResponse(value);return}}catch{}
   }
   sendResponse({status:"UNKNOWN"});
  })().catch(()=>sendResponse({status:"UNKNOWN"}));return true;
 }
 if(message?.type==="DDAKDAMA_IMPORT_PLAN_LINK"){
  const planUrl=String(message.planUrl??"");
  let trusted=false;
  trusted=isTrustedPlanLink(planUrl);
  if(!trusted){sendResponse({ok:false,error:"INVALID_PLAN_LINK"});return false}
  chrome.storage.local.set({"ddakdama-pending-plan-link":planUrl}).then(async()=>{
   let opened=false;
   if(_sender.tab?.id!==undefined){try{await chrome.sidePanel.open({tabId:_sender.tab.id});opened=true}catch{}}
   sendResponse({ok:true,opened});
  }).catch(()=>sendResponse({ok:false,error:"HANDOFF_STORE_FAILED"}));
  return true
 }
 if(message?.type==="DDAKDAMA_PING"){sendResponse({ok:true,name:"ddakdama",version:chrome.runtime.getManifest().version,affiliateEnabled,supportsPlanImport:true,cartAutomationEnabled});return false}
 if(message?.type==="DDAKDAMA_GET_CART_JOURNAL"){recoverableJournal().then(journal=>sendResponse({ok:true,journal}));return true}
 if(message?.type==="DDAKDAMA_RESUME_CART_JOURNAL"){if(!cartAutomationEnabled){sendResponse({ok:false,error:"CART_AUTOMATION_DISABLED",results:[]});return false}recoverableJournal().then(journal=>journal?runCartJobs(journal.runId,journal.jobs).then(results=>sendResponse({ok:true,results,journal:null})):sendResponse({ok:false,error:"NO_RECOVERABLE_JOURNAL",results:[]}));return true}
 if(message?.type==="DDAKDAMA_CLEAR_CART_JOURNAL"){chrome.storage.local.remove(journalKey).then(()=>sendResponse({ok:true}));return true}
 if(message?.type==="DDAKDAMA_OPEN_CART"){openCart().then(tabId=>sendResponse({ok:true,tabId})).catch(error=>sendResponse({ok:false,error:error instanceof Error?error.message:"OPEN_CART_FAILED"}));return true}
 if(message?.type==="DDAKDAMA_PREFLIGHT"){if(!cartAutomationEnabled){sendResponse({ok:false,error:"CART_AUTOMATION_DISABLED",results:[]});return false}if(!validJobs(message.jobs)){sendResponse({ok:false,error:"INVALID_JOBS",results:[]});return false}(async()=>{let tabId:number|undefined;try{tabId=await createWorkerTab();const results=[];for(const job of message.jobs)results.push(await inspectJob(job,tabId).catch(error=>({...job,status:error instanceof Error?error.message:"UNKNOWN_ERROR"})));sendResponse({ok:true,results})}finally{await closeWorkerTab(tabId)}})().catch(error=>sendResponse({ok:false,error:error instanceof Error?error.message:"PREFLIGHT_FAILED",results:[]}));return true}
 if(message?.type==="DDAKDAMA_RUN_CART_JOBS"){if(!cartAutomationEnabled){sendResponse({ok:false,error:"CART_AUTOMATION_DISABLED",results:[]});return false}if(!validJobs(message.jobs)){sendResponse({ok:false,error:"INVALID_JOBS",results:[]});return false}applyAffiliateLinks(message.jobs).then(jobs=>runCartJobs(String(message.runId??crypto.randomUUID()),jobs)).then(results=>sendResponse({ok:true,results}));return true}
 if(message?.type==="DDAKDAMA_SEARCH_ALL"){
  if(!cartAutomationEnabled){sendResponse({ok:false,error:"CART_AUTOMATION_DISABLED",output:[]});return false}
  if(searchBusy){sendResponse({ok:false,error:"SEARCH_IN_PROGRESS",output:[]});return false}
  if(!Array.isArray(message.items)||message.items.length<1||message.items.length>50){sendResponse({ok:false,error:"INVALID_ITEMS",output:[]});return false}
  searchBusy=true;
  searchBatch(message.items).then(sendResponse).catch(error=>sendResponse({ok:false,error:error instanceof Error?error.message:"SEARCH_FAILED",output:[]})).finally(()=>{searchBusy=false});
  return true;
 }
 if(message?.type==="DDAKDAMA_OPEN_SEARCH"){
  if(searchBusy){sendResponse({ok:false,error:"SEARCH_IN_PROGRESS"});return false}
  if(typeof message.query!=="string"||!message.query.trim()||message.query.length>150){sendResponse({ok:false,error:"INVALID_QUERY"});return false}
  searchBusy=true;
  (async()=>{const tabId=await acquireSearchTab();await navigateWorkerTab(tabId,searchHomeUrl,true);await submitShopSearch(message.query,tabId);return{ok:true,tabId}})().then(sendResponse).catch(error=>sendResponse({ok:false,error:error instanceof Error?error.message:"SEARCH_FAILED"})).finally(()=>{searchBusy=false});
  return true;
 }
 return false;
});
