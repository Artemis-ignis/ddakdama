import{defineConfig}from"vite";
import{resolve}from"node:path";

export default defineConfig({
 resolve:{alias:{"@ddakdama/core/product":resolve(__dirname,"../../packages/core/src/product.ts")}},
 build:{
  outDir:"dist",
  emptyOutDir:false,
  lib:{entry:resolve(__dirname,"src/coupang-content.ts"),formats:["iife"],name:"DdakDamaContent",fileName:()=>"content.js"},
 },
});
