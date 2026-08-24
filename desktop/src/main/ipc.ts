import { ipcMain, BrowserWindow } from "electron";
import { IPC, type OpName, type OpResponse } from "@shared/contract";
import { OpError } from "./db/errors";
import * as songs from "./db/repo/songs";
import * as sections from "./db/repo/sections";
import * as sets from "./db/repo/sets";
import * as library from "./db/repo/library";
import * as church from "./db/repo/church";
import * as dashboard from "./db/repo/dashboard";
import * as profile from "./db/repo/profile";
import { exportBackup, importBackup } from "./backup";
import { appInfo } from "./app-info";

/**
 * The allowlist. The renderer names an operation; it can never send SQL, and an
 * unknown name is rejected rather than falling through to anything.
 *
 * Keyed by OpName so a new entry in the contract that is not wired up here is
 * a type error rather than a runtime 404.
 */
type Handler = (args: never, window?: BrowserWindow) => unknown;

const handlers: Record<OpName, Handler> = {
  "songs.list": () => songs.list(),
  "songs.get": ({ songId }: { songId: string }) => songs.get(songId),
  "songs.create": ({ values, sourceTemplateId }) => songs.create(values, sourceTemplateId),
  "songs.update": ({ songId, values }) => songs.update(songId, values),
  "songs.delete": ({ songId }: { songId: string }) => {
    songs.remove(songId);
    return null;
  },
  "songs.picker": () => songs.picker(),

  "sections.save": (args) => sections.save(args),

  "sets.list": () => sets.list(),
  "sets.get": ({ setId }: { setId: string }) => sets.get(setId),
  "sets.create": ({ name, description }) => sets.create(name, description),
  "sets.update": ({ setId, name, description }) => sets.update(setId, name, description),
  "sets.delete": ({ setId }: { setId: string }) => {
    sets.remove(setId);
    return null;
  },
  "sets.saveItems": ({ setId, songIds }) => {
    sets.saveItems(setId, songIds);
    return null;
  },

  "library.list": () => library.list(),
  "library.addedTemplateIds": () => library.addedTemplateIds(),
  "library.addToChurch": ({ templateId }: { templateId: string }) =>
    library.addToChurch(templateId),

  "church.get": () => church.get(),
  "church.update": ({ patch }) => {
    church.update(patch);
    return null;
  },

  "dashboard.stats": () => dashboard.stats(),

  "profile.get": () => profile.get(),
  "profile.update": ({ patch }) => {
    profile.update(patch);
    return null;
  },

  "app.info": () => appInfo(),

  "backup.export": (_args, window) => exportBackup(window),
  "backup.import": (_args, window) => importBackup(window),
} as Record<OpName, Handler>;

export function registerIpc(): void {
  ipcMain.handle(
    IPC.invoke,
    async (event, op: OpName, args: unknown): Promise<OpResponse<unknown>> => {
      const handler = handlers[op];
      if (!handler) {
        return { ok: false, code: "UNKNOWN", message: `Unknown operation "${op}".` };
      }
      try {
        const window = BrowserWindow.fromWebContents(event.sender) ?? undefined;
        const value = await handler(args as never, window);
        return { ok: true, value };
      } catch (err) {
        if (err instanceof OpError) {
          return { ok: false, code: err.code, message: err.message };
        }
        const message = err instanceof Error ? err.message : String(err);
        console.error(`[ipc] ${op} failed:`, err);
        return { ok: false, code: "UNKNOWN", message };
      }
    },
  );
}
