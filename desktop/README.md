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
| `@/lib/build-target` | `renderer/build-target.ts` |

Two aliases are not data modules. AppShell, because the frame genuinely
differs: there is no account to sign out of and no role to display. And
`build-target`, which is how a shared page asks which build it is running
inside — it is what removes the "Browse library" button from the songs page
here (see below).

The practical consequence is that **a change to a page in `../src` reaches the
desktop app for free**, and a change to any module in that table has to be
mirrored in its stand-in. Both builds are type-checked against the same
component code, so a signature that drifts is a compile error rather than a
runtime surprise.

Excluded entirely: auth, onboarding, marketing, legal, encoder and superadmin.
None of them means anything without a server. Since 1.0.1 the shared song
library at `/songs/library` is excluded too, for a different reason — see
"The hymnal" below.

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
row, the full 419-song library as read-only templates, and **every published
one of them copied into the church's own hymnal**.

Regenerate the seed from the migrations with `npm run seed`.

## The hymnal

This is the one place the desktop deliberately behaves differently from the
hosted app, rather than just fetching differently.

On the web, signup copies the 20 `is_starter` hymns and the other 399 are
browsed and added one at a time from `/songs/library`. That page earns its
place there: the library is platform-owned, an encoder keeps adding to it, and
a church on a shared platform should not wake up to 419 songs it never asked
for.

None of that is true here. The whole library is already inside the installer,
there is no encoder and no one else to affect, and nothing is downloaded — so
browsing a catalog to copy songs out of it costs the user a step and buys them
nothing. The first launch copies all of it into the hymnal, and **the library
page does not exist in this build**: `/songs/library` redirects to `/songs`,
and `HAS_SHARED_LIBRARY` (see the alias table) drops the "Browse library"
button, so the page is tree-shaken out of the bundle entirely.

23 of those hymns are `metadata_only` — still under copyright, shipped with no
stanzas (see [docs/hymnal-copyright-review.md](../docs/hymnal-copyright-review.md)).
They are copied in too, arriving as a title, author and key for the church to
type its own licensed copy into, rather than the hymn disappearing from the app.

**Installs already in the field** are handled by migration step 2
(`adoptLibraryIntoHymnal` in `src/main/db/migrate.ts`), which copies every
published template that is not in the hymnal yet. Without it, upgrading from
1.0.0 would strand 399 hymns behind a page that no longer exists.

## The Bible

The whole King James Version ships **inside the installer** and is read from
SQLite. No network call is ever made to fetch a verse, which is the entire
point: this build exists for buildings whose internet is a phone hotspot, and
scripture going on the sanctuary screen is the last thing that should depend on
it holding up.

`resources/bible-seed.json` (~4.5MB, 31,102 verses) is generated by
`npm run bible:seed` **from the repo root**, not from here. It works by applying
`supabase/migrations/0020_bible.sql` and `0021_bible_kjv_verses.sql` to a
throwaway Postgres and reading the rows back, so the desktop's scripture is by
construction the same rows the hosted app serves. Re-run it whenever those
migrations change.

The load happens once, on the first launch after installing or upgrading, in
`seedBibleIfEmpty` — one transaction for all 31,102 verses, then a single FTS5
`rebuild`. It is guarded separately from `seedIfEmpty`, because that one decides
it has already run by looking for a church row, which says nothing about whether
scripture is present: an install upgrading from 1.0.x has a church and no Bible.

Where SQLite forced a difference from Postgres:

| Postgres | SQLite | Why |
| --- | --- | --- |
| `tsvector` + GIN | FTS5, `porter` tokenizer | Both stem, so "comfort" finds "comforted" |
| `text[]` aliases | JSON text | SQLite has no array type; parsed in `repo/bible.ts` |
| `boolean` | `integer` | Converted on the way out, so the renderer never sees a `0` where the web hands it `false` |
| `websearch_to_tsquery` | `buildFtsQuery` | FTS5 has the same capabilities under a different syntax and none of the tolerance — a stray `*` is a hard error, not a shrug |

`buildFtsQuery` re-quotes every term rather than passing the string through.
That is not only escaping: a double-quoted token in FTS5 is a literal phrase, so
every operator a user might type by accident (`*`, `^`, `:`, `NEAR`) is inert.

Nothing writes to these tables and there is no write operation in the IPC
allowlist — which is what stands in for the hosted app's "select policies and
no others".

## First run

A fresh install is not empty, and that is the problem the setup wizard solves.
The installer has already put a church row, 419 hymns and the whole KJV on the
machine; without being told, the user opens a dashboard belonging to somebody
called "My Church" and has no idea any of it is there.

`WelcomePage` runs once before the router is reachable — `App.tsx` gates on it
rather than redirecting, so there is no route to type past it and no redirect
loop to get stuck in. It says what came with the app, then asks the only two
questions worth asking: the church name (which is on every screen and in the
projector's window title) and what to call the user.

It hands over to the dashboard's spotlight tour. Those are **two flags, not
one** — `setup_completed` and `onboarding_completed` — because they run in
sequence and a single flag could not say which of the two the app still owed.

**Installs already in the field** are handled by migration step 4, which sets
`setup_completed` when a church row already exists. A church row is the tell: on
an upgrade there is one, and on a fresh install `migrate()` runs before
`seedIfEmpty` creates it. Without that step, every existing user would be asked
to introduce themselves again after upgrading.

## The splash screen

`src/renderer/splash.html` is a second page in the renderer build — no script,
pure CSS, so it paints as soon as it is parsed. `src/main/splash.ts` shows it
frameless, transparent and always on top, **before** opening the database:
seeding four and a half thousand rows on a first run is synchronous and blocks
the main process, including the protocol handler that serves this page.

The main window is created straight after and shows itself underneath as soon
as its renderer is ready. The splash then fades out (driven from main with
`setOpacity`, not from CSS) to reveal it, with a floor on how briefly it can
appear so a warm start reads as a screen rather than a flicker.

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

The Bible seed is built from the repo ROOT, not here: `npm run bible:seed`.
See [The Bible](#the-bible).

### Installers

**If the repository lives inside OneDrive** (or Dropbox, or any syncing
folder), `electron-builder` fails part-way through packaging with:

```
⨯ EPERM: operation not permitted, rename
  'release\win-unpacked.tmp' -> 'release\win-unpacked'
```

The sync client has the output directory open while it uploads, and Windows
will not rename a directory out from under it. It is not a code problem and
retrying does not help — it also leaves a `release/win-unpacked.tmp` behind
that has to be deleted before the next attempt.

Build somewhere the sync client is not watching, then copy the installer back:

```sh
rm -rf release/win-unpacked.tmp
OUT="$TEMP/sagipmusica-release"
npm run build && npx electron-builder --win -c.directories.output="$OUT"
cp "$OUT/SagipMusica-Setup.exe" release/
```

Note that piping the build through `tail` hides the failure: the exit code you
see is `tail`'s, not `electron-builder`'s, so a broken build reports success.

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
