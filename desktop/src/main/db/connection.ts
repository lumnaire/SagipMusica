import Database from "better-sqlite3";
import { app } from "electron";
import path from "node:path";

export type Db = Database.Database;

let db: Db | null = null;

export function databasePath(): string {
  return path.join(app.getPath("userData"), "sagipmusica.db");
}

/**
 * Opens (and memoises) the one connection the app uses. better-sqlite3 is
 * synchronous, so this lives in the main process only — the renderer reaches
 * it over IPC and never loads the native module.
 */
export function openDb(): Db {
  if (db) return db;

  db = new Database(databasePath());
  // WAL survives a hard power-cut mid-service far better than the default
  // rollback journal, and lets a read run while a write is in flight.
  db.pragma("journal_mode = WAL");
  db.pragma("synchronous = NORMAL");
  // Off by default in SQLite; the schema leans on ON DELETE CASCADE.
  db.pragma("foreign_keys = ON");
  return db;
}

export function getDb(): Db {
  if (!db) throw new Error("Database not open. Call openDb() during app startup.");
  return db;
}

export function closeDb(): void {
  db?.close();
  db = null;
}

/** ISO-8601 with milliseconds, matching the `created_at: string` shape the UI expects. */
export function nowIso(): string {
  return new Date().toISOString();
}
