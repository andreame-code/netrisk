/// <reference types="vite/client" />

declare const __NETRISK_APP_ENVIRONMENT__: string;
declare const __NETRISK_APP_RELEASE__: string;

interface ImportMetaEnv {
  readonly VITE_SENTRY_DSN?: string;
}
