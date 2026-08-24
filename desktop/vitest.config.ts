import { defineConfig } from "vitest/config";
import path from "node:path";

const here = import.meta.dirname;
const desktop = (p: string) => path.resolve(here, "src", p);

/**
 * Tests for the main process only.
 *
 * The renderer is the web app's components with a different data layer behind
 * them, and those components are already covered by the web test suite. What
 * is new here — and what a mistake in would quietly corrupt a church's hymnal
 * — is the SQLite schema and the repositories, so that is what runs under
 * Node with a real database in a temp directory.
 *
 * `electron` is aliased to a stub because connection.ts asks it where the user
 * data directory is, and there is no Electron runtime in a vitest process.
 */
export default defineConfig({
  test: {
    environment: "node",
    include: ["test/**/*.test.ts"],
  },
  resolve: {
    alias: [
      { find: "electron", replacement: path.resolve(here, "test/electron-stub.ts") },
      { find: "@shared", replacement: desktop("shared") },
      { find: "@", replacement: path.resolve(here, "../src") },
    ],
  },
});
