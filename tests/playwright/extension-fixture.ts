import{test as base,chromium,type BrowserContext,type Worker}from"@playwright/test";
import path from"node:path";
import{fileURLToPath}from"node:url";
const here=path.dirname(fileURLToPath(import.meta.url));
const extensionPath=path.resolve(here,"../../apps/extension");
export const test=base.extend<{context:BrowserContext;extensionId:string;extensionWorker:Worker}>({
 context:async({},use)=>{const context=await chromium.launchPersistentContext("",{channel:"chromium",headless:true,args:[`--disable-extensions-except=${extensionPath}`,`--load-extension=${extensionPath}`]});await use(context);await context.close()},
 extensionWorker:async({context},use)=>{let worker=context.serviceWorkers()[0];if(!worker)worker=await context.waitForEvent("serviceworker");await use(worker)},
 extensionId:async({extensionWorker},use)=>{await use(new URL(extensionWorker.url()).host)},
});
export{expect}from"@playwright/test";
