import { BrowserWindow } from "electron";
import { APP_ORIGIN } from "./protocol";

const WIDTH = 400;
const HEIGHT = 268;

/**
 * How long the splash stays up at minimum.
 *
 * Opening the database, migrating and seeding is fast on a warm start, so
 * without a floor the splash would appear and vanish inside 200ms — read as a
 * flicker, or as something having gone wrong. Long enough to register as a
 * deliberate screen, short enough that nobody waits on it.
 */
const MIN_VISIBLE_MS = 1150;

/** The fade-out. Matched to the card's entrance so both halves feel the same. */
const FADE_MS = 280;
const FADE_TICK_MS = 16;

/**
 * Last resort. If the main window never reaches ready-to-show — a renderer
 * that fails to boot — the splash must not be left sitting on the user's
 * screen forever with no way to close it.
 */
const SAFETY_MS = 20_000;

export interface Splash {
  window: BrowserWindow;
  /** Fades the splash out and destroys it. Safe to call more than once. */
  dismiss(): void;
}

/**
 * The window shown while the app boots.
 *
 * Frameless, transparent and always on top, with no script of its own: the
 * page is pure CSS (see renderer/splash.html) so it paints as soon as it is
 * parsed, which is the whole point of showing it.
 *
 * The main window is created immediately after this one and shows itself
 * underneath as soon as it is ready. The splash then fades away to reveal it,
 * rather than closing and letting a bare window snap in — the fade IS the
 * transition, which is why it is driven from here with setOpacity instead of
 * from CSS inside the page.
 */
export function createSplash(devServerUrl?: string): Splash {
  const window = new BrowserWindow({
    width: WIDTH,
    height: HEIGHT,
    show: false,
    frame: false,
    transparent: true,
    hasShadow: false,
    resizable: false,
    movable: true,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    center: true,
    backgroundColor: "#00000000",
    title: "SagipMusica",
    webPreferences: {
      // No preload and no IPC: this page has nothing to ask the main process
      // for, so it is given no way to.
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  window.once("ready-to-show", () => {
    if (!window.isDestroyed()) window.show();
  });

  const url = devServerUrl
    ? `${devServerUrl}/splash.html`
    : `${APP_ORIGIN}/splash.html`;
  void window.loadURL(url);

  let dismissed = false;
  const shownAt = Date.now();

  const fadeOut = () => {
    if (window.isDestroyed()) return;

    let step = 0;
    const steps = Math.max(1, Math.round(FADE_MS / FADE_TICK_MS));
    const timer = setInterval(() => {
      if (window.isDestroyed()) {
        clearInterval(timer);
        return;
      }
      step += 1;
      const t = step / steps;
      // Eased rather than linear: a linear fade reads as a light being
      // switched off in stages.
      window.setOpacity(Math.max(0, 1 - t * t));
      if (step >= steps) {
        clearInterval(timer);
        window.destroy();
      }
    }, FADE_TICK_MS);
  };

  const dismiss = () => {
    if (dismissed) return;
    dismissed = true;
    clearTimeout(safety);
    const remaining = Math.max(0, MIN_VISIBLE_MS - (Date.now() - shownAt));
    setTimeout(fadeOut, remaining);
  };

  const safety = setTimeout(dismiss, SAFETY_MS);

  return { window, dismiss };
}
