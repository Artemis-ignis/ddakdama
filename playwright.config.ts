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
  {command:"pnpm --filter @ddakdama/extension dev:preview",url:"http://127.0.0.1:4273/dev/candidates",reuseExistingServer:false,timeout:60_000},
  // The fixture is test-owned state. Start a fresh process so a stale or
  // absent local fixture never makes browser-cart verification flaky.
  {command:"node tests/playwright/cart-fixture-server.mjs",url:"http://127.0.0.1:4174/health",reuseExistingServer:false,timeout:30_000},
 ],
 projects:[
  {name:"extension",testMatch:/(?:extension|tab-reuse)\.spec\.ts/},
  {name:"preview",testMatch:/preview\.spec\.ts/,use:{baseURL:"http://127.0.0.1:4273",viewport:{width:420,height:1000}}},
  {name:"widget",testMatch:/widget\.spec\.ts/},
 ],
});
