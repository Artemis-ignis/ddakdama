import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  WIDGET_URI,
  widgetHtml,
} from "../../server/src/widget.ts";

const here = dirname(fileURLToPath(import.meta.url));
const outputDir = resolve(here, "../.generated");
const output = resolve(outputDir, "widget.ts");
const iconDataUrl = widgetHtml.match(/<img class="logo" src="([^"]+)"/)?.[1];
if (!iconDataUrl) throw new Error("WIDGET_ICON_NOT_FOUND");

await mkdir(outputDir, { recursive: true });
await writeFile(
  output,
  `// Generated from apps/server/src/widget.ts. Do not edit.\nexport const WIDGET_URI = ${JSON.stringify(WIDGET_URI)};\nexport const widgetHtml = ${JSON.stringify(widgetHtml)};\nexport const appIconDataUrl = ${JSON.stringify(iconDataUrl)};\n`,
  "utf8",
);
