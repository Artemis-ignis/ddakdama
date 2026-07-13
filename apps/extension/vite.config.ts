import {defineConfig} from "vite";
import react from "@vitejs/plugin-react";
import {resolve} from "node:path";
export default defineConfig({base:"./",plugins:[react()],build:{outDir:"dist",emptyOutDir:true,rollupOptions:{input:{sidepanel:resolve(__dirname,"index.html"),background:resolve(__dirname,"src/background.ts"),content:resolve(__dirname,"src/coupang-content.ts")},output:{entryFileNames:chunk=>chunk.name==="background"?"background.js":chunk.name==="content"?"content.js":"assets/[name]-[hash].js"}}}});
