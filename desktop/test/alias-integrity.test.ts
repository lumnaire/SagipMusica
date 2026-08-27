import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import path from "node:path";

/**
 * The desktop build works by aliasing a handful of the web app's modules to
 * SQLite/IPC versions of themselves. Vite matches an alias against the
 * SPECIFIER AS WRITTEN, not against the file it eventually resolves to — so
 * `@/features/bible/api` is swapped and `../api` from the folder next door is
 * not, even though both name the same file.
 *
 * That is a nasty failure. A relative import slips the real module into the
 * desktop bundle, it imports the Supabase client, the client throws at module
 * load because a desktop build has no VITE_SUPABASE_URL, and the renderer
 * dies before React mounts. The symptom is a white window on launch with
 * nothing in it — no error page, no partial UI, and nothing to suggest the
 * cause is one word in one import.
 *
 * It shipped once, in 1.2.1, via BibleBrowser.tsx. Nothing else catches it:
 * `tsc` resolves both spellings happily because they are the same file, and
 * the web suite never loads the alias table at all. So it is checked here,
 * statically, against the real config.
 */

const DESKTOP = path.resolve(import.meta.dirname, "..");
const WEB_SRC = path.resolve(DESKTOP, "../src");
const CONFIG = path.join(DESKTOP, "electron.vite.config.ts");

/** Extension order Vite would try for an extensionless specifier. */
const EXTENSIONS = [".ts", ".tsx", ".js", ".jsx"];

/**
 * The `@/...` specifiers the config replaces. Read out of the config as text
 * rather than by importing it, which would pull in the whole plugin chain.
 */
function aliasedSpecifiers(): string[] {
  const source = readFileSync(CONFIG, "utf8");
  const table = source.slice(
    source.indexOf("const dataLayerOverrides"),
    source.indexOf("export default defineConfig"),
  );

  return [...table.matchAll(/find:\s*"(@\/[^"]+)"/g)].map((m) => m[1]);
}

/** Absolute path of the web-side file an alias shadows, if it exists. */
function resolveWebFile(specifier: string): string | null {
  const base = path.join(WEB_SRC, specifier.slice("@/".length));
  for (const ext of EXTENSIONS) {
    if (existsSync(base + ext)) return base + ext;
  }
  if (existsSync(base) && statSync(base).isDirectory()) {
    for (const ext of EXTENSIONS) {
      const index = path.join(base, `index${ext}`);
      if (existsSync(index)) return index;
    }
  }
  return null;
}

function sourceFiles(dir: string): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      found.push(...sourceFiles(full));
    } else if (/\.(ts|tsx)$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name)) {
      found.push(full);
    }
  }
  return found;
}

function relativeImports(file: string): string[] {
  const source = readFileSync(file, "utf8");
  return [
    ...source.matchAll(/(?:from|import)\s*["'](\.[^"']*)["']/g),
  ].map((m) => m[1]);
}

describe("desktop alias integrity", () => {
  const specifiers = aliasedSpecifiers();

  it("reads the alias table out of the real config", () => {
    // If this drops to nothing the parser has gone stale and every assertion
    // below would pass vacuously.
    expect(specifiers.length).toBeGreaterThanOrEqual(10);
    expect(specifiers).toContain("@/features/bible/api");
    expect(specifiers).toContain("@/stores/auth-store");
  });

  it("every aliased specifier still points at a real web module", () => {
    // A rename on the web side that leaves the alias behind means the alias
    // silently stops applying.
    const dangling = specifiers.filter((s) => resolveWebFile(s) === null);
    expect(dangling).toEqual([]);
  });

  it("no reused web module reaches an aliased file by a relative path", () => {
    const shadowed = new Map<string, string>();
    for (const specifier of specifiers) {
      const file = resolveWebFile(specifier);
      if (file) shadowed.set(file, specifier);
    }

    const offenders: string[] = [];

    for (const file of sourceFiles(WEB_SRC)) {
      for (const specifier of relativeImports(file)) {
        const target = path.resolve(path.dirname(file), specifier);

        for (const candidate of [
          ...EXTENSIONS.map((ext) => target + ext),
          ...EXTENSIONS.map((ext) => path.join(target, `index${ext}`)),
        ]) {
          if (!shadowed.has(candidate)) continue;

          offenders.push(
            `${path.relative(WEB_SRC, file).replace(/\\/g, "/")} imports "${specifier}" ` +
              `— write "${shadowed.get(candidate)}" instead, or the desktop build ` +
              `bundles the web version of it`,
          );
        }
      }
    }

    expect(offenders).toEqual([]);
  });
});
