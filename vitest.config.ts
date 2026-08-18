import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: [
      { find: "@", replacement: path.resolve(import.meta.dirname, "./src") },
      // Vite's dev server resolves root-absolute imports like
      // "/church-logo-no-bg.png" against `public/` automatically, but
      // Vitest's Node-based resolver doesn't — it tries to treat the
      // string as a literal filesystem path and crashes. Route them at
      // `public/` explicitly so component tests can import those files too.
      {
        find: /^\/(.+\.(png|jpe?g|svg|gif|webp|ico))$/,
        replacement: path.resolve(import.meta.dirname, "./public/$1"),
      },
    ],
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    css: false,
  },
});
