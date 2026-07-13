import{defineConfig}from"vite";
import react from"@vitejs/plugin-react";
import{resolve}from"node:path";
export default defineConfig({root:__dirname,plugins:[react()],resolve:{alias:{"@ddakdama/core":resolve(__dirname,"../../../packages/core/src/index.ts")}},server:{host:"127.0.0.1",port:4173,strictPort:true},build:{outDir:resolve(__dirname,"../preview-dist"),emptyOutDir:true}});
