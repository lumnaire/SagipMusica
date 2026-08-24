import { app, net, protocol } from "electron";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { existsSync, statSync } from "node:fs";

export const APP_SCHEME = "app";
export const APP_ORIGIN = `${APP_SCHEME}://sagipmusica`;

/**
 * Must run before `app.whenReady()`.
 *
 * The renderer is served over a custom scheme rather than file://, for three
 * reasons: file:// has an opaque origin, which breaks storage APIs and makes
 * cross-window messaging unreliable; React Router's BrowserRouter needs real
 * URL paths; and a proper origin is what makes the CSP meaningful.
 */
export function registerAppScheme(): void {
  protocol.registerSchemesAsPrivileged([
    {
      scheme: APP_SCHEME,
      privileges: {
        standard: true,
        secure: true,
        supportFetchAPI: true,
        corsEnabled: true,
        stream: true,
      },
    },
  ]);
}

/** Serves the built renderer, falling back to index.html so deep routes work. */
export function handleAppScheme(rendererDir: string): void {
  const indexHtml = path.join(rendererDir, "index.html");

  protocol.handle(APP_SCHEME, async (request) => {
    const { pathname } = new URL(request.url);
    const decoded = decodeURIComponent(pathname);

    // Resolve inside rendererDir and verify it stayed there: a request for
    // app://sagipmusica/../../etc/passwd must not escape the bundle.
    const candidate = path.join(rendererDir, decoded);
    const withinBundle =
      candidate === rendererDir || candidate.startsWith(rendererDir + path.sep);

    const isFile = withinBundle && existsSync(candidate) && statSync(candidate).isFile();
    // Anything that is not a real file is an application route (/songs/123),
    // which the SPA resolves client-side from index.html.
    const target = isFile ? candidate : indexHtml;

    return net.fetch(pathToFileURL(target).toString());
  });
}

/** Where the built renderer lives, packaged or not. */
export function rendererDir(): string {
  return app.isPackaged
    ? path.join(process.resourcesPath, "app.asar", "out", "renderer")
    : path.join(app.getAppPath(), "out", "renderer");
}
