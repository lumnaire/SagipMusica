import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: [
      { find: "@", replacement: path.resolve(import.meta.dirname, "./src") },
      // Vite's dev server resolves root-absolute imports like
      // "/sagipmusica-logo.png" against `public/` automatically, but
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
    // The desktop app has its own suite: main-process code that runs in Node
    // against a real SQLite file, with `electron` aliased to a stub. It cannot
    // run under this jsdom config, so it stays behind `npm test` in desktop/.
    exclude: ["**/node_modules/**", "**/dist/**", "desktop/**"],
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    css: false,
  },
});
