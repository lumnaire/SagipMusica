import { defineConfig, externalizeDepsPlugin } from "electron-vite";
import type { Plugin } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "node:path";

const here = import.meta.dirname;
const webSrc = path.resolve(here, "../src");
const desktopSrc = path.resolve(here, "src");

const desktop = (p: string) => path.join(desktopSrc, p);

/**
 * Puts the renderer's `base` back to "/" for the production build.
 *
 * electron-vite's own renderer preset forces `base: "./"` whenever mode is
 * production, overwriting whatever the config below asks for, because it
 * assumes the renderer is loaded over file://. This app is not: it is served
 * from app://sagipmusica/ and routed by BrowserRouter, so relative asset URLs
 * would resolve against the current route.
 *
 * That is not theoretical — the projector window is opened straight at
 * /presentation/:sessionId/projector, where "./assets/index.js" resolves to
 * app://sagipmusica/presentation/:sessionId/assets/index.js. The protocol
 * handler serves index.html for anything that is not a real file, so the
 * window would be handed HTML where it expected a script and never start.
 *
 * `enforce: "post"` is what makes this win: config hooks run pre, then normal,
 * then post, and the preset that clobbers it is a "pre" plugin.
 */
function absoluteBasePlugin(): Plugin {
  return {
    name: "sagipmusica:absolute-base",
    enforce: "post",
    config: () => ({ base: "/" }),
  };
}

/**
 * The data layer swap.
 *
 * The desktop renderer imports the web app's components and pages from
 * `../src` verbatim. These aliases redirect only the modules that talk to
 * Supabase at each of their exact import specifiers, pointing them at
 * SQLite/IPC implementations that export the same names.
 *
 * AppShell is the one exception that is not a data module: the frame is where
 * the two builds genuinely differ rather than just fetching differently — the
 * web sidebar ends in a sign-out button and a role label, and neither exists
 * on a machine with no accounts.
 *
 * ORDER MATTERS: Vite matches aliases in array order and a bare `@` would
 * swallow every one of these, so the specific overrides come first.
 */
const dataLayerOverrides = [
  { find: "@/features/songs/api", replacement: desktop("renderer/data/songs.ts") },
  { find: "@/features/songs/hooks/useSongs", replacement: desktop("renderer/data/useSongs.ts") },
  { find: "@/features/worship-sets/api", replacement: desktop("renderer/data/worship-sets.ts") },
  { find: "@/features/dashboard/api", replacement: desktop("renderer/data/dashboard.ts") },
  { find: "@/features/bible/api", replacement: desktop("renderer/data/bible.ts") },
  // Not a data module in the usual sense -- there is no desktop equivalent of
  // the 3-Text Hunt at all. It is here because the song editor and the Bible
  // browser are shared verbatim and both import it; the stand-in reports the
  // event as off. See desktop/renderer/data/event.ts.
  { find: "@/features/event/api", replacement: desktop("renderer/data/event.ts") },
  { find: "@/lib/save-sections", replacement: desktop("renderer/data/save-sections.ts") },
  {
    find: "@/features/presentation/engine/loadPresentation",
    replacement: desktop("renderer/data/loadPresentation.ts"),
  },
  {
    find: "@/features/presentation/engine/channel",
    replacement: desktop("renderer/data/channel.ts"),
  },
  { find: "@/stores/auth-store", replacement: desktop("renderer/data/auth-store.ts") },
  { find: "@/stores/church-store", replacement: desktop("renderer/data/church-store.ts") },
  {
    find: "@/components/layout/AppShell",
    replacement: desktop("renderer/components/AppShell.tsx"),
  },
  // Not a data module either: the flags that tell a shared page which build it
  // is running inside. See src/lib/build-target.ts.
  { find: "@/lib/build-target", replacement: desktop("renderer/build-target.ts") },
];

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    resolve: {
      alias: [
        { find: "@shared", replacement: desktop("shared") },
        { find: "@", replacement: webSrc },
      ],
    },
    build: {
      rollupOptions: {
        input: { index: desktop("main/index.ts") },
      },
    },
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    resolve: {
      alias: [
        { find: "@shared", replacement: desktop("shared") },
        { find: "@", replacement: webSrc },
      ],
    },
    build: {
      rollupOptions: {
        input: { index: desktop("preload/index.ts") },
        // CommonJS, and .cjs so it stays CommonJS under this package's
        // "type": "module". A sandboxed preload is not an ES module — Electron
        // loads it into the sandbox with require(), so an `import` statement
        // there fails at load time and the window comes up with no `sagip`
        // object on it at all. See sandbox: true in main/windows.ts.
        output: { format: "cjs", entryFileNames: "[name].cjs" },
      },
    },
  },
  renderer: {
    root: desktop("renderer"),
    // Absolute, NOT './'. The app is served from app://-/ and uses
    // BrowserRouter, so a relative base would resolve assets against nested
    // paths like /songs/123 and 404 on every deep route.
    base: "/",
    plugins: [react(), tailwindcss(), absoluteBasePlugin()],
    resolve: {
      alias: [
        ...dataLayerOverrides,
        { find: "@shared", replacement: desktop("shared") },
        { find: "@", replacement: webSrc },
      ],
      // The reused files live under ../src, so bare imports (react, radix,
      // zustand...) resolve from the ROOT node_modules while desktop-only
      // files resolve from desktop/node_modules. Deduping keeps a single
      // React instance across that boundary.
      dedupe: ["react", "react-dom", "react-router-dom", "zustand"],
    },
    build: {
      rollupOptions: {
        input: {
          index: desktop("renderer/index.html"),
          // A second page, not part of the app: the boot splash, shown by the
          // main process while the renderer bundle below is still parsing. It
          // is built through Vite purely so its logo is hashed and emitted
          // like every other asset, and so it is served over app:// too.
          splash: desktop("renderer/splash.html"),
        },
      },
    },
  },
});
