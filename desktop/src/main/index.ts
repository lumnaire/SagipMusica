import { app, BrowserWindow } from "electron";
import path from "node:path";
import { electronApp, optimizer } from "@electron-toolkit/utils";
import { closeDb, openDb } from "./db/connection";
import { migrate } from "./db/migrate";
import { seedIfEmpty } from "./db/seed";
import { registerIpc } from "./ipc";
import { registerPresentationRelay } from "./presentation-relay";
import { handleAppScheme, registerAppScheme, rendererDir } from "./protocol";
import { createMainWindow } from "./windows";

// Must happen before the app is ready.
registerAppScheme();

/** The hymn library that ships inside the installer. */
function seedPath(): string {
  return app.isPackaged
    ? path.join(process.resourcesPath, "hymnal-seed.json")
    : path.join(app.getAppPath(), "resources", "hymnal-seed.json");
}

// One instance only: two processes writing the same SQLite file is asking for
// trouble, and a second launch should surface the window that already exists.
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on("second-instance", () => {
    const [existing] = BrowserWindow.getAllWindows();
    if (existing) {
      if (existing.isMinimized()) existing.restore();
      existing.focus();
    }
  });

  app.whenReady().then(() => {
    electronApp.setAppUserModelId("com.lumnaire.sagipmusica");

    const db = openDb();
    migrate(db);
    seedIfEmpty(db, seedPath());

    registerIpc();
    registerPresentationRelay();

    // In dev, electron-vite serves the renderer over http and sets this.
    const devServerUrl = process.env["ELECTRON_RENDERER_URL"];
    if (!devServerUrl) handleAppScheme(rendererDir());

    app.on("browser-window-created", (_event, window) => {
      optimizer.watchWindowShortcuts(window);
    });

    createMainWindow(devServerUrl);

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
