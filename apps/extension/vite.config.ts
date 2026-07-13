import {defineConfig} from "vite";
import react from "@vitejs/plugin-react";
import {resolve} from "node:path";
export default defineConfig(({mode})=>({base:"./",plugins:[react()],define:mode==="test"?{"import.meta.env.VITE_DDAKDAMA_CART_URL":JSON.stringify("http://127.0.0.1:4174/cart")}:{},resolve:{alias:{"@ddakdama/core":resolve(__dirname,"../../packages/core/src/index.ts")}},build:{outDir:"dist",emptyOutDir:true,rollupOptions:{input:{sidepanel:resolve(__dirname,"index.html"),background:resolve(__dirname,"src/background.ts")},output:{entryFileNames:chunk=>chunk.name==="background"?"background.js":"assets/[name]-[hash].js"}}}}));
