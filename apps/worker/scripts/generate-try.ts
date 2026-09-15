import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const here = dirname(fileURLToPath(import.meta.url));
const coreEntry = resolve(here, "../../../packages/core/src/index.ts");
const outputDir = resolve(here, "../.generated");
const output = resolve(outputDir, "try.ts");

const result = await build({
  entryPoints: [coreEntry],
  bundle: true,
  format: "iife",
  globalName: "DDAKDAMA_CORE",
  platform: "browser",
  write: false,
  minify: true,
  logLevel: "warning",
});

const coreJs = result.outputFiles[0]?.text ?? "";
if (!coreJs.includes("parseShoppingList")) {
  throw new Error("TRY_CORE_BUNDLE_MISSING_PARSER");
}

await mkdir(outputDir, { recursive: true });
await writeFile(
  output,
  `// Generated from packages/core. Do not edit.\nexport const tryCoreJs = ${JSON.stringify(coreJs)};\n`,
  "utf8",
);

console.log(`[generate-try] bundled core -> ${output} (${coreJs.length} bytes)`);
