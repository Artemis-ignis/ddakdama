/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_DDAKDAMA_API_ORIGIN?: string;
  /** Set only after the link-beta Custom GPT is published. */
  readonly VITE_DDAKDAMA_GPT_URL?: string;
}
