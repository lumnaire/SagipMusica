import { app, BrowserWindow } from "electron";
import path from "node:path";
import { electronApp, optimizer } from "@electron-toolkit/utils";
import { closeDb, openDb } from "./db/connection";
import { migrate } from "./db/migrate";
import { seedIfEmpty } from "./db/seed";
import { seedBibleIfEmpty } from "./db/bible-seed";
import { registerIpc } from "./ipc";
import { registerPresentationRelay } from "./presentation-relay";
import { handleAppScheme, registerAppScheme, rendererDir } from "./protocol";
import { createSplash } from "./splash";
import { createMainWindow } from "./windows";

// Must happen before the app is ready.
registerAppScheme();

/** Held only so the second-instance handler can tell it apart. */
let splashWindow: BrowserWindow | null = null;

/** A file that ships inside the installer, wherever it ended up. */
function resourcePath(filename: string): string {
  return app.isPackaged
    ? path.join(process.resourcesPath, filename)
    : path.join(app.getAppPath(), "resources", filename);
}

// One instance only: two processes writing the same SQLite file is asking for
// trouble, and a second launch should surface the window that already exists.
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on("second-instance", () => {
    // The splash is skipped: during the first second of a launch it is the
    // only window there is, and focusing it would do nothing useful.
    const existing = BrowserWindow.getAllWindows().find(
      (w) => w !== splashWindow && !w.isDestroyed(),
    );
    if (existing) {
      if (existing.isMinimized()) existing.restore();
      existing.focus();
    }
  });

  app.whenReady().then(() => {
    electronApp.setAppUserModelId("com.lumnaire.sagipmusica");

    // In dev, electron-vite serves the renderer over http and sets this.
    const devServerUrl = process.env["ELECTRON_RENDERER_URL"];
    // Before the splash, not after: in the packaged build the splash page is
    // served over app://, and this is what serves it.
    if (!devServerUrl) handleAppScheme(rendererDir());

    app.on("browser-window-created", (_event, window) => {
      optimizer.watchWindowShortcuts(window);
    });

    // Created before the database work, which on a first run seeds four and a
    // half thousand rows. That work is synchronous and blocks this process --
    // including the protocol handler that serves the splash -- so creating the
    // window first is what gets it painting the moment the seed lets go,
    // rather than a second later alongside the main window.
    const splash = createSplash(devServerUrl);
    splashWindow = splash.window;

    const db = openDb();
    migrate(db);
    seedIfEmpty(db, resourcePath("hymnal-seed.json"));
    // First launch after installing or upgrading to 1.2.1. Takes a couple of
    // seconds for 31,102 verses; the splash is still up while it runs.
    seedBibleIfEmpty(db, resourcePath("bible-seed.json"));

    registerIpc();
    registerPresentationRelay();

    // The main window shows itself underneath as soon as its renderer is
    // ready; the splash then fades away to reveal it.
    const mainWindow = createMainWindow(devServerUrl);
    mainWindow.once("ready-to-show", () => splash.dismiss());
    // A window that closes before it ever painted would otherwise leave the
    // splash up until its safety timer fires.
    mainWindow.once("closed", () => splash.dismiss());

    // macOS keeps the app alive with no windows; reopen on dock click.
    app.on("activate", () => {
      if (BrowserWindow.getAllWindows().length === 0) createMainWindow(devServerUrl);
    });
  });

  app.on("window-all-closed", () => {
    if (process.platform !== "darwin") app.quit();
  });

  app.on("will-quit", () => {
    closeDb();
  });
}
