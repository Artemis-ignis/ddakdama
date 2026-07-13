/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_DDAKDAMA_SERVER_ORIGIN?: string;
  readonly VITE_DDAKDAMA_CART_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
