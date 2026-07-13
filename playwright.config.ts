import{defineConfig}from"@playwright/test";
export default defineConfig({
 testDir:"./tests/playwright",
 fullyParallel:false,
 workers:1,
 timeout:45_000,
 reporter:[["list"],["html",{outputFolder:"output/playwright/report",open:"never"}]],
 outputDir:"output/playwright/artifacts",
 use:{trace:"retain-on-failure",screenshot:"only-on-failure",video:"retain-on-failure"},
 webServer:[
  {command:"pnpm --filter @ddakdama/extension dev:preview",url:"http://127.0.0.1:4173/dev/candidates",reuseExistingServer:true,timeout:60_000},
  {command:"node tests/playwright/cart-fixture-server.mjs",url:"http://127.0.0.1:4174/health",reuseExistingServer:true,timeout:30_000},
 ],
 projects:[
  {name:"extension",testMatch:/(?:extension|tab-reuse)\.spec\.ts/},
  {name:"preview",testMatch:/preview\.spec\.ts/,use:{baseURL:"http://127.0.0.1:4173",viewport:{width:420,height:1000}}},
 ],
});
