import{planCartResume,type CartCheckpoint}from"./cart-journal";
import{detailStatus,validateProductUrl,type ProductDetail}from"./product-validation";

chrome.runtime.onInstalled.addListener(()=>chrome.sidePanel.setPanelBehavior({openPanelOnActionClick:true}));
type Job={id:string;productUrl:string;navigationUrl?:string;productId:string;vendorItemId:string|null;itemId:string|null;cartPurchaseQuantity:number;expectedBrand:string|null;expectedProductName:string;expectedUnitsPerPackage:number;expectedUnitSize:string|null;expectedStrength:string|null;expectedPackageContent:string|null;status:string};
type JobResult=Job&{status:string;beforeQuantity?:number;afterQuantity?:number;verifiedPrice?:number;cartPrice?:number;expectedSubtotal?:number;priceDifference?:number};
type Journal={runId:string;jobs:Job[];results:JobResult[];checkpoints:Record<string,CartCheckpoint>;startedAt:number;updatedAt:number};
const journalKey="ddakdama-cart-journal";
const serverOrigin=(import.meta.env.VITE_DDAKDAMA_SERVER_ORIGIN||"http://localhost:8787").replace(/\/$/,"");
const cartUrl=import.meta.env.VITE_DDAKDAMA_CART_URL||"https://cart.coupang.com/cartView.pang";
const validJob=(job:unknown):job is Job=>{const value=job as Partial<Job>;return Boolean(value&&typeof value.id==="string"&&value.id.length<=100&&typeof value.productUrl==="string"&&value.productUrl.length<=2000&&typeof value.productId==="string"&&/^\d+$/.test(value.productId)&&typeof value.expectedProductName==="string"&&value.expectedProductName.length>0&&value.expectedProductName.length<=300&&(value.expectedBrand===null||typeof value.expectedBrand==="string")&&Number.isInteger(value.cartPurchaseQuantity)&&Number(value.cartPurchaseQuantity)>=1&&Number(value.cartPurchaseQuantity)<=20&&Number.isInteger(value.expectedUnitsPerPackage)&&Number(value.expectedUnitsPerPackage)>=1&&Number(value.expectedUnitsPerPackage)<=20)};
const validJobs=(jobs:unknown):jobs is Job[]=>Array.isArray(jobs)&&jobs.length>0&&jobs.length<=50&&jobs.every(validJob);

async function sendToTab(tabId:number,message:unknown){let lastError:unknown;for(let attempt=0;attempt<3;attempt+=1){try{return await chrome.tabs.sendMessage(tabId,message)}catch(error){lastError=error;if(attempt<2)await new Promise(resolve=>setTimeout(resolve,200*(attempt+1)))}}throw lastError instanceof Error?lastError:new Error("CONTENT_SCRIPT_UNAVAILABLE")}
async function waitComplete(tabId:number){for(let attempt=0;attempt<150;attempt+=1){const current=await chrome.tabs.get(tabId);if(current.status==="complete")return;await new Promise(resolve=>setTimeout(resolve,100))}throw new Error("NETWORK_ERROR")}
async function cartSnapshot(){const tab=await chrome.tabs.create({url:cartUrl,active:false});if(!tab.id)throw new Error("CART_TAB_FAILED");try{await waitComplete(tab.id);return await sendToTab(tab.id,{type:"DDAKDAMA_CART_SNAPSHOT"})}finally{await chrome.tabs.remove(tab.id).catch(()=>{})}}
type SnapshotItem={productId:string;vendorItemId:string|null;itemId:string|null;quantity:number;price:number|null};
const itemOf=(snapshot:{items?:SnapshotItem[]},job:Job)=>snapshot.items?.find(item=>item.productId===job.productId&&(!job.vendorItemId||item.vendorItemId===job.vendorItemId)&&(!job.itemId||item.itemId===job.itemId));
const quantityOf=(snapshot:{items?:SnapshotItem[]},job:Job)=>itemOf(snapshot,job)?.quantity??0;
async function inspectJob(job:Job){if(!validateProductUrl(job))return{...job,status:"PRODUCT_MISMATCH"};const tab=await chrome.tabs.create({url:job.navigationUrl??job.productUrl,active:false});if(!tab.id)throw new Error("PRODUCT_TAB_FAILED");try{await waitComplete(tab.id);const detail=await sendToTab(tab.id,{type:"DDAKDAMA_INSPECT_PRODUCT"}) as ProductDetail;return{...job,status:detailStatus(job,detail),verifiedPrice:detail.price,verifiedTitle:detail.title}}finally{await chrome.tabs.remove(tab.id).catch(()=>{})}}
async function waitForQuantity(job:Job,minimum:number){for(let attempt=0;attempt<4;attempt++){const quantity=quantityOf(await cartSnapshot(),job);if(quantity>=minimum)return quantity;await new Promise(resolve=>setTimeout(resolve,350))}return quantityOf(await cartSnapshot(),job)}

async function runJob(job:Job,checkpoint:CartCheckpoint|undefined,persist:(value:CartCheckpoint)=>Promise<void>){
 const current=quantityOf(await cartSnapshot(),job);
 const resume=planCartResume(current,job.cartPurchaseQuantity,checkpoint);
 const nextCheckpoint:CartCheckpoint={jobId:job.id,beforeQuantity:resume.beforeQuantity,targetQuantity:resume.targetQuantity,updatedAt:Date.now()};
 await persist(nextCheckpoint);
 const tab=await chrome.tabs.create({url:job.navigationUrl??job.productUrl,active:false});if(!tab.id)throw new Error("PRODUCT_TAB_FAILED");
 try{
  await waitComplete(tab.id);const detail=await sendToTab(tab.id,{type:"DDAKDAMA_INSPECT_PRODUCT"}) as ProductDetail;const status=detailStatus(job,detail);if(status!=="READY")return{...job,status};
  let observed=current;for(let i=0;i<resume.remainingQuantity;i++){const expectedAfterClick=current+i+1;const added=await sendToTab(tab.id,{type:"DDAKDAMA_ADD_TO_CART"});if(!added.ok)return{...job,status:added.reason??"ADD_BUTTON_NOT_FOUND"};observed=await waitForQuantity(job,expectedAfterClick);if(observed<expectedAfterClick)return{...job,status:"CART_VERIFICATION_FAILED"}}
  const finalSnapshot=await cartSnapshot();const after=quantityOf(finalSnapshot,job);const cartPrice=itemOf(finalSnapshot,job)?.price??undefined;const expectedSubtotal=detail.price?detail.price*after:undefined;const priceDifference=cartPrice!==undefined&&expectedSubtotal!==undefined?cartPrice-expectedSubtotal:undefined;
  return{...job,status:after===resume.targetQuantity?"SUCCESS":"QUANTITY_MISMATCH",beforeQuantity:resume.beforeQuantity,afterQuantity:after,verifiedPrice:detail.price??undefined,cartPrice,expectedSubtotal,priceDifference};
 }finally{await chrome.tabs.remove(tab.id).catch(()=>{})}
}
async function runCartJobs(runId:string,jobs:Job[]){
 const stored=await chrome.storage.local.get(journalKey);const previous=stored[journalKey] as Journal|undefined;
 const journal:Journal=previous?.runId===runId?previous:{runId,jobs,results:[],checkpoints:{},startedAt:Date.now(),updatedAt:Date.now()};
 for(const job of jobs){
  const completed=journal.results.find(result=>result.id===job.id);if(completed)continue;
  const result=await runJob(job,journal.checkpoints[job.id],async checkpoint=>{journal.checkpoints[job.id]=checkpoint;journal.updatedAt=Date.now();await chrome.storage.local.set({[journalKey]:journal})}).catch(error=>({...job,status:error instanceof Error?error.message:"UNKNOWN_ERROR"}));
  journal.results.push(result);journal.updatedAt=Date.now();await chrome.storage.local.set({[journalKey]:journal});
 }
 return journal.results;
}
async function recoverableJournal(){
 const stored=await chrome.storage.local.get(journalKey);const journal=stored[journalKey] as Journal|undefined;
 if(!journal||!validJobs(journal.jobs)||journal.results.length>=journal.jobs.length)return null;
 return journal;
}
async function searchOne(query:string){const tab=await chrome.tabs.create({url:"https://www.coupang.com/np/search?q="+encodeURIComponent(query),active:false});if(!tab.id)throw new Error("SEARCH_TAB_FAILED");try{await waitComplete(tab.id);const value=await sendToTab(tab.id,{type:"DDAKDAMA_SEARCH_RESULTS"});return value?.results??[]}finally{await chrome.tabs.remove(tab.id).catch(()=>{})}}
async function deviceToken(){
 const stored=await chrome.storage.local.get("ddakdama-device-token");const existing=String(stored["ddakdama-device-token"]??"");if(existing)return existing;
 try{const response=await fetch(`${serverOrigin}/api/pairing/start`,{method:"POST",headers:{"content-type":"application/json"},body:"{}"});if(!response.ok)return"";const data=await response.json() as{deviceId?:string;deviceToken?:string};if(!data.deviceToken)return"";await chrome.storage.local.set({"ddakdama-device-id":data.deviceId??"","ddakdama-device-token":data.deviceToken});return data.deviceToken}catch{return""}
}
async function partnerSearch(query:string){const token=await deviceToken();if(!token)return[];try{const response=await fetch(`${serverOrigin}/api/affiliate/search`,{method:"POST",headers:{authorization:`Bearer ${token}`,"content-type":"application/json"},body:JSON.stringify({keyword:query,limit:8})});if(!response.ok)return[];return(await response.json()).results??[]}catch{return[]}}
async function applyAffiliateLinks(jobs:Job[]){const token=await deviceToken();if(!token)return jobs;try{const response=await fetch(`${serverOrigin}/api/affiliate/deeplink`,{method:"POST",headers:{authorization:`Bearer ${token}`,"content-type":"application/json"},body:JSON.stringify({urls:jobs.map(job=>job.productUrl)})});if(!response.ok)return jobs;const links=(await response.json()).links??[];return jobs.map(job=>({...job,navigationUrl:links.find((link:{originalUrl:string})=>link.originalUrl===job.productUrl)?.landingUrl??job.productUrl}))}catch{return jobs}}

chrome.runtime.onMessage.addListener((message,_sender,sendResponse)=>{
 if(message?.type==="DDAKDAMA_PING"){sendResponse({ok:true,name:"ddakdama",version:chrome.runtime.getManifest().version});return false}
 if(message?.type==="DDAKDAMA_GET_CART_JOURNAL"){recoverableJournal().then(journal=>sendResponse({ok:true,journal}));return true}
 if(message?.type==="DDAKDAMA_RESUME_CART_JOURNAL"){recoverableJournal().then(journal=>journal?runCartJobs(journal.runId,journal.jobs).then(results=>sendResponse({ok:true,results,journal:null})):sendResponse({ok:false,error:"NO_RECOVERABLE_JOURNAL",results:[]}));return true}
 if(message?.type==="DDAKDAMA_CLEAR_CART_JOURNAL"){chrome.storage.local.remove(journalKey).then(()=>sendResponse({ok:true}));return true}
 if(message?.type==="DDAKDAMA_OPEN_CART"){chrome.tabs.create({url:"https://cart.coupang.com/cartView.pang"});sendResponse({ok:true});return false}
 if(message?.type==="DDAKDAMA_PREFLIGHT"){if(!validJobs(message.jobs)){sendResponse({ok:false,error:"INVALID_JOBS",results:[]});return false}(async()=>{const results=[];for(const job of message.jobs)results.push(await inspectJob(job).catch(error=>({...job,status:error instanceof Error?error.message:"UNKNOWN_ERROR"})));sendResponse({ok:true,results})})();return true}
 if(message?.type==="DDAKDAMA_RUN_CART_JOBS"){if(!validJobs(message.jobs)){sendResponse({ok:false,error:"INVALID_JOBS",results:[]});return false}applyAffiliateLinks(message.jobs).then(jobs=>runCartJobs(String(message.runId??crypto.randomUUID()),jobs)).then(results=>sendResponse({ok:true,results}));return true}
 if(message?.type==="DDAKDAMA_SEARCH_ALL"){if(!Array.isArray(message.items)||message.items.length<1||message.items.length>50){sendResponse({ok:false,error:"INVALID_ITEMS",output:[]});return false}(async()=>{const output=[];for(const item of message.items){if(typeof item.rawText!=="string"||item.rawText.length>500){output.push({requestLineId:String(item.id??""),results:[],error:"INVALID_ITEM"});continue}try{const partner=await partnerSearch(item.rawText);const browser=await searchOne(item.rawText);const results=[...partner,...browser].filter((candidate,index,all)=>all.findIndex(other=>other.productId===candidate.productId&&other.vendorItemId===candidate.vendorItemId)===index);output.push({requestLineId:item.id,results})}catch(error){output.push({requestLineId:item.id,results:[],error:error instanceof Error?error.message:"SEARCH_FAILED"})}}sendResponse({ok:true,output})})();return true}
 return false;
});
