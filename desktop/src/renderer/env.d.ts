/// <reference types="vite/client" />

import type { SagipApi } from "../preload";

declare global {
  interface Window {
    /** Exposed by src/preload/index.ts via contextBridge. */
    readonly sagip: SagipApi;
  }
}

export {};
