import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

/**
 * Stands in for the `electron` module under vitest.
 *
 * Only `app.getPath("userData")` is reached from the code under test — it is
 * how connection.ts decides where the database file lives. Pointing it at a
 * fresh temp directory per run is what keeps the tests from touching a real
 * install's hymnal.
 */
const userData = mkdtempSync(path.join(tmpdir(), "sagipmusica-test-"));

export const app = {
  getPath(name: string): string {
    if (name === "userData") return userData;
    return userData;
  },
  getVersion: () => "0.0.0-test",
  isPackaged: false,
  getAppPath: () => path.resolve(import.meta.dirname, ".."),
};

/** The temp directory this run is using, for assertions and cleanup. */
export const TEST_USER_DATA = userData;
