import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const envText = await readFile(resolve(root, ".env.local"), "utf8");
const tokenLine = envText.split(/\r?\n/).find((line) => line.startsWith("SUPPORT_ADMIN_TOKEN="));
const token = tokenLine?.slice("SUPPORT_ADMIN_TOKEN=".length).trim();
const origin = (process.env.DDAKDAMA_PUBLIC_ORIGIN || "https://ddakdama.ddakdama.workers.dev").replace(/\/$/, "");

if (!token) throw new Error("SUPPORT_ADMIN_TOKEN is missing. Run pnpm support:setup first.");

const health = await fetch(`${origin}/health`);
if (!health.ok) throw new Error(`Health check failed: HTTP ${health.status}`);

const supportPage = await fetch(`${origin}/support`);
const supportHtml = await supportPage.text();
if (!supportPage.ok || !supportHtml.includes('action="/api/support"')) {
  throw new Error("Public support form is unavailable.");
}

const marker = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
const submit = await fetch(`${origin}/api/support`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({
    email: `qa+${marker}@example.com`,
    subject: `automated verification ${marker}`,
    message: "This is an automated public support round-trip verification ticket.",
    website: "",
  }),
});
const submitted = await submit.json();
if (!submit.ok || !submitted.ticketId) throw new Error(`Support submission failed: HTTP ${submit.status}`);

const inbox = await fetch(`${origin}/api/support/tickets?limit=50`, {
  headers: { authorization: `Bearer ${token}` },
});
const inboxPayload = await inbox.json();
if (!inbox.ok || !inboxPayload.tickets?.some((ticket) => ticket.id === submitted.ticketId)) {
  throw new Error("Submitted support ticket was not returned by the admin inbox.");
}

const resolveResponse = await fetch(
  `${origin}/api/support/tickets/${encodeURIComponent(submitted.ticketId)}/resolve`,
  { method: "POST", headers: { authorization: `Bearer ${token}` } },
);
const resolved = await resolveResponse.json();
if (!resolveResponse.ok || !resolved.ticket?.resolvedAt) {
  throw new Error(`Support ticket resolution failed: HTTP ${resolveResponse.status}`);
}

console.log("Public support round-trip verification passed.");
