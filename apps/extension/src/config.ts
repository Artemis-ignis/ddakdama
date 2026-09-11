/** The existing GPTs, Worker service and extension share this production origin. */
export const DEFAULT_SERVER_ORIGIN = "https://ddakdama.ddakdama.workers.dev";

export const SERVER_ORIGIN = (
  import.meta.env.VITE_DDAKDAMA_SERVER_ORIGIN || DEFAULT_SERVER_ORIGIN
).replace(/\/$/, "");

// Preserve the existing GPT/MCP pairing endpoint while accepting plans from
// the deployed web/Android service. Never forward a plan grant to another host.
export const PUBLIC_WEB_ORIGIN = "https://ddakdama.artemis-clunk.workers.dev";
export function isTrustedPlanLink(value: unknown): value is string {
  if (typeof value !== "string" || value.length > 2500) return false;
  try {
    const url = new URL(value);
    return [SERVER_ORIGIN, PUBLIC_WEB_ORIGIN].includes(url.origin)
      && !url.username && !url.password
      && ["/", "/app", "/app/"].includes(url.pathname)
      && Boolean(url.searchParams.get("plan")) && Boolean(url.searchParams.get("grant"));
  } catch { return false; }
}
