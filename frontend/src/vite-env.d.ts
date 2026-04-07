/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_APP_MODE: "online" | "offline";
  readonly VITE_GOOGLE_CLIENT_ID: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
