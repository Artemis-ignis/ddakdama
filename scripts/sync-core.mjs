import { copyFile, readFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const source = resolve(root, "shared/core.js");
const targets = [resolve(root, "extension/lib/core.js"), resolve(root, "gpt-app/lib/core.js")];

for (const target of targets) await copyFile(source, target);
const canonical = await readFile(source, "utf8");
for (const target of targets) {
  const content = await readFile(target, "utf8");
  if (content !== canonical) throw new Error(`동기화 실패: ${target}`);
}
console.log("공용 코어 동기화 완료");
