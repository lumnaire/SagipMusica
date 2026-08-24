import { BrowserWindow, screen, shell } from "electron";
import path from "node:path";
import { APP_ORIGIN } from "./protocol";

const PROJECTOR_FRAME_NAME = "worship-projector";

// .cjs, not .mjs: sandboxed preloads are loaded with require(). The preload
// build in electron.vite.config.ts emits CommonJS to match.
const preloadPath = (): string =>
  path.join(import.meta.dirname, "..", "preload", "index.cjs");

function baseWebPreferences() {
  return {
    preload: preloadPath(),
    // The renderer never touches Node or the native SQLite module; everything
    // goes through the allowlisted IPC surface in ipc.ts.
    contextIsolation: true,
    nodeIntegration: false,
    sandbox: true,
    webSecurity: true,
  };
}

/**
 * Places the projector on a display that is not the one the presenter is on.
 * Falls back to a plain window when there is only one screen, so the operator
 * can still see and drag it.
 */
function projectorPlacement(parent: BrowserWindow) {
  const displays = screen.getAllDisplays();
  const presenterDisplay = screen.getDisplayMatching(parent.getBounds());
  const secondary = displays.find((d) => d.id !== presenterDisplay.id);

  if (!secondary) {
    return { width: 1280, height: 720, fullscreen: false, frame: true };
  }

  const { x, y, width, height } = secondary.bounds;
  return { x, y, width, height, fullscreen: true, frame: false };
}

export function createMainWindow(devServerUrl?: string): BrowserWindow {
  const window = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 640,
    show: false,
    backgroundColor: "#ffffff",
    autoHideMenuBar: true,
    title: "SagipMusica",
    webPreferences: baseWebPreferences(),
  });

  window.once("ready-to-show", () => window.show());

  /**
   * PresenterView calls window.open(url, "worship-projector") and shows a
   * "pop-up blocked" toast when it gets null back. So this must ALLOW the
   * window and let Electron create it — denying here and building the window
   * by hand would return null to the renderer and trip that toast.
   */
  window.webContents.setWindowOpenHandler(({ frameName, url }) => {
    if (frameName === PROJECTOR_FRAME_NAME) {
      return {
        action: "allow",
        overrideBrowserWindowOptions: {
          ...projectorPlacement(window),
          // The sanctuary screen shows lyrics on black and nothing else.
          backgroundColor: "#000000",
          autoHideMenuBar: true,
          title: "SagipMusica — Projector",
          webPreferences: baseWebPreferences(),
        },
      };
    }

    // Anything else (an external link) belongs in the user's browser, not in
    // a chrome-less Electron window.
    if (url.startsWith("http:") || url.startsWith("https:")) {
      void shell.openExternal(url);
    }
    return { action: "deny" };
  });

  if (devServerUrl) {
    void window.loadURL(devServerUrl);
  } else {
    void window.loadURL(`${APP_ORIGIN}/`);
  }

  return window;
}
