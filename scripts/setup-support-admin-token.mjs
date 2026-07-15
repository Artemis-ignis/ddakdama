import { randomBytes } from "node:crypto";
import { readFile, rename, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const envPath = resolve(root, ".env.local");
const tempPath = `${envPath}.tmp`;

let text = "";
try {
  text = await readFile(envPath, "utf8");
} catch (error) {
  if (error?.code !== "ENOENT") throw error;
}

const lines = text.split(/\r?\n/).filter(Boolean);
const keyIndex = lines.findIndex((line) => line.startsWith("SUPPORT_ADMIN_TOKEN="));
const existing = keyIndex >= 0 ? lines[keyIndex].slice("SUPPORT_ADMIN_TOKEN=".length).trim() : "";

if (existing.length >= 32) {
  console.log("SUPPORT_ADMIN_TOKEN is already configured in .env.local.");
  process.exit(0);
}

const token = randomBytes(32).toString("base64url");
const entry = `SUPPORT_ADMIN_TOKEN=${token}`;
if (keyIndex >= 0) lines[keyIndex] = entry;
else lines.push(entry);

await writeFile(tempPath, `${lines.join("\n")}\n`, { encoding: "utf8", mode: 0o600 });
await rename(tempPath, envPath);
console.log("Created a new SUPPORT_ADMIN_TOKEN in .env.local.");
