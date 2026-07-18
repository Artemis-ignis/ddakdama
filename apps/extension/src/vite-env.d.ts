/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_DDAKDAMA_SERVER_ORIGIN?: string;
  readonly VITE_DDAKDAMA_CART_URL?: string;
  readonly VITE_DDAKDAMA_AFFILIATE_ENABLED?: string;
  /** Public user-facing ChatGPT app link, set after the app has one. */
  readonly VITE_DDAKDAMA_CHATGPT_APP_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
