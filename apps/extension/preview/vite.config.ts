import{defineConfig}from"vite";
import react from"@vitejs/plugin-react";
import{resolve}from"node:path";
import{tmpdir}from"node:os";
import{rmSync}from"node:fs";
const previewOutDir=resolve(tmpdir(),`ddakdama-preview-${process.pid}`);
export default defineConfig({root:__dirname,plugins:[react(),{name:"ddakdama-clean-preview",closeBundle(){rmSync(previewOutDir,{recursive:true,force:true})}}],resolve:{alias:{"@ddakdama/core":resolve(__dirname,"../../../packages/core/src/index.ts")}},server:{host:"127.0.0.1",port:4173,strictPort:true},build:{outDir:previewOutDir,emptyOutDir:true}});
