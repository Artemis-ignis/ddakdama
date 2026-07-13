/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_DDAKDAMA_SERVER_ORIGIN?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
