import{test as base,chromium,type BrowserContext,type Worker}from"@playwright/test";
import path from"node:path";
import{tmpdir}from"node:os";
import{fileURLToPath}from"node:url";
import{cpSync,mkdirSync,readFileSync,rmSync,writeFileSync}from"node:fs";
const here=path.dirname(fileURLToPath(import.meta.url));
const sourceExtensionPath=path.resolve(here,"../../apps/extension");
const sourceBuildPath=path.resolve(here,"../../output/extension-test-dist");
const temporaryRoot=path.join(tmpdir(),`ddakdama-playwright-${process.pid}`);
const extensionPath=path.join(temporaryRoot,"extension-under-test");
function prepareExtension(){rmSync(extensionPath,{recursive:true,force:true});mkdirSync(extensionPath,{recursive:true});cpSync(sourceBuildPath,path.join(extensionPath,"dist"),{recursive:true});cpSync(path.join(sourceExtensionPath,"assets"),path.join(extensionPath,"assets"),{recursive:true});const manifest=JSON.parse(readFileSync(path.join(sourceExtensionPath,"manifest.json"),"utf8"));manifest.host_permissions=[...manifest.host_permissions,"http://127.0.0.1:4174/*"];manifest.content_scripts[0].matches=[...manifest.content_scripts[0].matches,"http://127.0.0.1:4174/*"];writeFileSync(path.join(extensionPath,"manifest.json"),JSON.stringify(manifest,null,2))}
export const test=base.extend<{context:BrowserContext;extensionId:string;extensionWorker:Worker}>({
 context:async({},use)=>{prepareExtension();const context=await chromium.launchPersistentContext("",{channel:"chromium",headless:true,args:[`--disable-extensions-except=${extensionPath}`,`--load-extension=${extensionPath}`]});try{await use(context)}finally{await context.close();rmSync(temporaryRoot,{recursive:true,force:true})}},
 extensionWorker:async({context},use)=>{let worker=context.serviceWorkers()[0];if(!worker)worker=await context.waitForEvent("serviceworker");await use(worker)},
 extensionId:async({extensionWorker},use)=>{await use(new URL(extensionWorker.url()).host)},
});
export{expect}from"@playwright/test";
