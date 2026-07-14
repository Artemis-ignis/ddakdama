/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_DDAKDAMA_SERVER_ORIGIN?: string;
  readonly VITE_DDAKDAMA_CART_URL?: string;
  readonly VITE_DDAKDAMA_AFFILIATE_ENABLED?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
