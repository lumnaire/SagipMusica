import schemaSql from "./schema.sql?raw";
import type { Db } from "./connection";

/**
 * Ordered migrations, driven by SQLite's `user_version` pragma. Step N runs
 * when user_version < N and bumps it to N. Never edit a shipped step — add a
 * new one, or installs in the field will diverge from fresh ones.
 */
const MIGRATIONS: { version: number; up: (db: Db) => void }[] = [
  {
    version: 1,
    up: (db) => db.exec(schemaSql),
  },
];

export function migrate(db: Db): number {
  const current = db.pragma("user_version", { simple: true }) as number;
  const pending = MIGRATIONS.filter((m) => m.version > current).sort(
    (a, b) => a.version - b.version,
  );

  for (const migration of pending) {
    // Each step is its own transaction so a failure leaves user_version
    // pointing at the last step that fully applied.
    db.transaction(() => {
      migration.up(db);
      // Pragmas cannot be parameterised; the value is a literal from this file.
      db.pragma(`user_version = ${migration.version}`);
    })();
  }

  return db.pragma("user_version", { simple: true }) as number;
}

export const LATEST_VERSION = Math.max(...MIGRATIONS.map((m) => m.version));
