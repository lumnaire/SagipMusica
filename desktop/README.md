# SagipMusica Desktop

The offline-first desktop build. Same app, no server: the hymnal lives in a
SQLite file on the user's machine, and the app never makes a network request.

Built for churches whose sanctuary has no reliable internet — the whole library
ships inside the installer, and a service can be run with the cable unplugged.

## How it reuses the web app

The renderer imports the web app's pages and components from `../src`
**verbatim**. Nothing is copied. What changes is what sits behind them: a small
set of Vite aliases in [`electron.vite.config.ts`](electron.vite.config.ts)
redirect the handful of modules that talk to Supabase to files under
`src/renderer/data/` that export the same names with the same signatures.

| Web module | Desktop stand-in |
| --- | --- |
| `@/features/songs/api` | `renderer/data/songs.ts` |
| `@/features/songs/hooks/useSongs` | `renderer/data/useSongs.ts` |
| `@/features/worship-sets/api` | `renderer/data/worship-sets.ts` |
| `@/features/dashboard/api` | `renderer/data/dashboard.ts` |
| `@/lib/save-sections` | `renderer/data/save-sections.ts` |
| `@/features/presentation/engine/loadPresentation` | `renderer/data/loadPresentation.ts` |
| `@/features/presentation/engine/channel` | `renderer/data/channel.ts` |
| `@/stores/auth-store` | `renderer/data/auth-store.ts` |
| `@/stores/church-store` | `renderer/data/church-store.ts` |
| `@/components/layout/AppShell` | `renderer/components/AppShell.tsx` |

AppShell is the only alias that is not a data module. The frame genuinely
differs: there is no account to sign out of and no role to display.

The practical consequence is that **a change to a page in `../src` reaches the
desktop app for free**, and a change to any module in that table has to be
mirrored in its stand-in. Both builds are type-checked against the same
component code, so a signature that drifts is a compile error rather than a
runtime surprise.

Excluded entirely: auth, onboarding, marketing, legal, encoder and superadmin.
None of them means anything without a server.

## Architecture

```
main process                        renderer process
─────────────                       ────────────────
better-sqlite3 ── repo/*.ts             pages from ../src
       │                                        │
       └── ipc.ts (allowlist) ◄── preload ◄── data/invoke.ts
```

- The renderer **never** touches Node, the filesystem, or SQLite. It names an
  operation from [`src/shared/contract.ts`](src/shared/contract.ts); main
  dispatches it through an allowlist keyed by that contract. Raw SQL cannot
  cross the boundary.
- Windows run with `contextIsolation: true`, `nodeIntegration: false` and
  `sandbox: true`. The preload is CommonJS because a sandboxed preload is
  loaded with `require()`.
- The renderer is served over a custom `app://` scheme rather than `file://`,
  so it has a real origin (storage APIs work, the CSP means something) and
  BrowserRouter's deep paths resolve.
- Presenter → projector sync goes through the main process rather than
  `BroadcastChannel`, because the two windows are separate renderer processes
  and a live service is not the place to find out that bridging them is flaky.

## The database

`src/main/db/schema.sql` is a faithful SQLite translation of the Postgres
schema in `supabase/migrations/`, with the same table and column names — which
is what lets `src/types/database.ts` and every component be reused unchanged.
`uuid` becomes `text`, `timestamptz` becomes an ISO-8601 string, and there is
no RLS because there is one local user.

Migrations are ordered steps driven by SQLite's `user_version` pragma in
`src/main/db/migrate.ts`. **Never edit a shipped step** — add a new one, or
installs in the field will diverge from fresh ones.

On first run the app seeds itself from `resources/hymnal-seed.json`: one church
row, the full 419-song library as read-only templates, and the 20 starter hymns
copied into the church's own hymnal — mirroring what signup does in the hosted
app, so a fresh install opens on a stocked dashboard rather than an empty one.

Regenerate the seed from the migrations with `npm run seed`.

## Backups

There is no server, so nothing is backed up for the user. Settings → Backup
writes a `.sagipdb` file using SQLite's own backup API (not a file copy — in
WAL mode the `.db` on disk can be missing recent commits). Restoring validates
the file before replacing anything, then relaunches, because every open window
is holding React state read from the old database.

## Commands

```sh
npm install          # also rebuilds native deps for Electron's ABI
npm run dev          # electron-vite dev, with HMR in the renderer
npm run typecheck    # checks the desktop AND the reused ../src files
npm test             # main-process tests: schema, migrations, repositories
npm run build        # bundles main, preload and renderer into out/
npm run seed         # regenerates resources/hymnal-seed.json from migrations
```

### Installers

```sh
npm run build:win    # release/SagipMusica-Setup.exe        (NSIS)
npm run build:mac    # release/SagipMusica-<arch>.dmg
npm run pack:dir     # unpacked build in release/, for quick testing
```

> **Building inside OneDrive:** this repo lives in a synced folder, and
> OneDrive grabs the freshly-extracted Electron runtime mid-build, which fails
> with `EPERM ... rename 'release\win-unpacked.tmp'`. Build to a path outside
> the synced folder and copy the installer back:
>
> ```sh
> npx electron-builder --win --config.directories.output=C:/Users/<you>/AppData/Local/Temp/sagipmusica-release
> ```

The installer filename is deliberately **versionless** (`SagipMusica-Setup.exe`)
because the website's download button uses GitHub's
`releases/latest/download/<asset>` redirect, which resolves by filename. Putting
the version in the name would break that link on every release.

Each target must be built **on its own platform** — a macOS disk image cannot
be produced from Windows. The Windows installer is per-user (no administrator
prompt) and lets the user choose the install directory.

Neither build is code-signed yet. Windows SmartScreen will warn on first run,
and macOS Gatekeeper will require right-click → Open. Add a certificate and
flip `hardenedRuntime`/`identity` in
[`electron-builder.yml`](electron-builder.yml) when one exists.

The app icon is derived from `build/icon.png` (1024×1024); electron-builder
generates the `.ico` and `.icns` from it.

## Testing

`test/db.test.ts` runs the real schema against a real SQLite file in a temp
directory. It covers the things that are new here and would quietly corrupt a
church's hymnal if wrong — the migration, the seed, the section diffing, the
worship-set ordering, and the duplicate-add path that has to surface as
`ALREADY_IN_HYMNAL` rather than a raw SQL error.

The renderer is not tested here: it is the web app's components, already
covered by the web suite.
