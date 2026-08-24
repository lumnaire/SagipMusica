import { app, dialog, BrowserWindow } from "electron";
import { copyFileSync, existsSync, unlinkSync } from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import type { BackupResult } from "@shared/contract";
import { closeDb, databasePath, getDb } from "./db/connection";

const FILTERS = [{ name: "SagipMusica backup", extensions: ["sagipdb"] }];

const stamp = () => new Date().toISOString().slice(0, 10);

/**
 * Writes a consistent copy of the live database.
 *
 * Uses better-sqlite3's `backup()` rather than copying the file: in WAL mode
 * the .db on disk can be missing recent commits that are still in the -wal,
 * so a plain copy risks handing back a backup that is quietly out of date.
 */
export async function exportBackup(parent?: BrowserWindow): Promise<BackupResult> {
  const { canceled, filePath } = await dialog.showSaveDialog(parent!, {
    title: "Save a backup",
    defaultPath: path.join(app.getPath("documents"), `sagipmusica-${stamp()}.sagipdb`),
    filters: FILTERS,
  });
  if (canceled || !filePath) return { completed: false, path: null };

  await getDb().backup(filePath);
  return { completed: true, path: filePath };
}

/**
 * Replaces the live database with a backup file, then restarts.
 *
 * A restart rather than an in-place swap: every open window is holding React
 * state read from the old database, and there is no reliable way to invalidate
 * all of it. Relaunching is honest and takes a second.
 */
export async function importBackup(parent?: BrowserWindow): Promise<BackupResult> {
  const { canceled, filePaths } = await dialog.showOpenDialog(parent!, {
    title: "Restore from a backup",
    properties: ["openFile"],
    filters: FILTERS,
  });
  if (canceled || filePaths.length === 0) return { completed: false, path: null };

  const source = filePaths[0];

  // Validate before destroying anything: an unreadable or foreign file must
  // fail here, with the current database still intact.
  const probe = new Database(source, { readonly: true, fileMustExist: true });
  try {
    const tables = probe
      .prepare("select name from sqlite_master where type = 'table' and name in ('churches','songs')")
      .all() as { name: string }[];
    if (tables.length !== 2) {
      throw new Error("That file is not a SagipMusica backup.");
    }
  } finally {
    probe.close();
  }

  const target = databasePath();
  closeDb();

  // WAL sidecars belong to the file being replaced; leaving them behind would
  // let SQLite replay them over the restored database.
  for (const suffix of ["-wal", "-shm"]) {
    const sidecar = `${target}${suffix}`;
    if (existsSync(sidecar)) unlinkSync(sidecar);
  }
  copyFileSync(source, target);

  app.relaunch();
  app.exit(0);
  return { completed: true, path: source };
}
