import { resolve } from "node:path";
import { defineConfig } from "vite";

export default defineConfig(({ mode }) => ({
  build: {
    emptyOutDir: false,
    lib: {
      entry: "src/ddakdama-plan-content.ts",
      formats: ["es"],
      fileName: () => "handoff-content.js",
    },
    outDir: mode === "test" ? resolve(__dirname, "../../output/extension-test-dist") : "dist",
    rollupOptions: { output: { inlineDynamicImports: true } },
  },
}));
