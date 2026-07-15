import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const envPath = resolve(root, ".env.local");
const defaultOrigin = "https://ddakdama.ddakdama.workers.dev";

function parseEnv(text) {
  return Object.fromEntries(
    text
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith("#") && line.includes("="))
      .map((line) => {
        const index = line.indexOf("=");
        return [line.slice(0, index), line.slice(index + 1)];
      }),
  );
}

function maskEmail(email) {
  const [local, domain] = email.split("@");
  if (!domain) return "(invalid email)";
  return `${local.slice(0, 2)}***@${domain}`;
}

let fileEnv = {};
try {
  fileEnv = parseEnv(await readFile(envPath, "utf8"));
} catch (error) {
  if (error?.code !== "ENOENT") throw error;
}

const token = process.env.SUPPORT_ADMIN_TOKEN || fileEnv.SUPPORT_ADMIN_TOKEN;
const origin = (process.env.DDAKDAMA_PUBLIC_ORIGIN || fileEnv.DDAKDAMA_PUBLIC_ORIGIN || defaultOrigin).replace(/\/$/, "");
if (!token) {
  throw new Error("SUPPORT_ADMIN_TOKEN is missing. Run: pnpm support:setup");
}

const resolveIndex = process.argv.indexOf("--resolve");
if (resolveIndex >= 0) {
  const id = process.argv[resolveIndex + 1];
  if (!id) throw new Error("Usage: pnpm support:inbox -- --resolve <ticket-id>");
  const response = await fetch(`${origin}/api/support/tickets/${encodeURIComponent(id)}/resolve`, {
    method: "POST",
    headers: { authorization: `Bearer ${token}` },
  });
  if (!response.ok) throw new Error(`Resolve failed: HTTP ${response.status}`);
  console.log(`Resolved support ticket ${id}.`);
  process.exit(0);
}

const response = await fetch(`${origin}/api/support/tickets?limit=50`, {
  headers: { authorization: `Bearer ${token}` },
});
if (!response.ok) throw new Error(`Inbox request failed: HTTP ${response.status}`);

const payload = await response.json();
const tickets = Array.isArray(payload.tickets) ? payload.tickets : [];
const showFull = process.argv.includes("--full");

console.log(`Support tickets: ${tickets.length}`);
for (const ticket of tickets) {
  console.log(`\n[${ticket.resolvedAt ? "RESOLVED" : "OPEN"}] ${ticket.id}`);
  console.log(`Created: ${ticket.createdAt}`);
  console.log(`Email: ${showFull ? ticket.email : maskEmail(ticket.email)}`);
  console.log(`Subject: ${ticket.subject}`);
  if (showFull) console.log(`Message: ${ticket.message}`);
}
