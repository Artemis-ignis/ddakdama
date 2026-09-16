export const DEFAULT_SERVER_ORIGIN = "https://ddakdama.artemis-clunk.workers.dev";

export const SERVER_ORIGIN = (
  import.meta.env.VITE_DDAKDAMA_SERVER_ORIGIN || DEFAULT_SERVER_ORIGIN
).replace(/\/$/, "");
