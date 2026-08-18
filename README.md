# FBC CONCORDIA

A church worship presentation & hymnal management system: manage a hymnal of
songs and stanzas, group them into worship sets, and run a distraction-free
16:9 presentation on a projector, synced live from a presenter view. Built
for church staff and volunteer worship teams, not developers.

## Tech stack

- React + Vite + TypeScript (strict)
- Tailwind CSS v4 + hand-rolled shadcn-style components (Radix UI primitives)
- Supabase (Postgres, Auth, Row Level Security)
- Zustand for presentation/session state
- `@dnd-kit` for drag-and-drop reordering
- Browser Fullscreen API + `BroadcastChannel` for presenter → projector sync

## Architecture

The presentation engine (`src/features/presentation/engine`) is deliberately
decoupled from the admin UI:

```
Supabase (Auth, Postgres)
        │
        ▼
  Admin / Presenter app  ──BroadcastChannel──▶  Projector window
  (loads slides from DB,                        (renders whatever it's
   controls the session)                         told, no network calls)
```

The Presenter window is the only thing that talks to Supabase during a live
service. Once a presentation starts, slide changes are pushed to the
Projector window over `BroadcastChannel` — no network round-trip per slide,
and the projector output stays completely free of admin UI, matching how it
will eventually be packaged as a Tauri desktop app.

## Getting started

### 1. Install dependencies

```bash
npm install
```

### 2. Create a Supabase project

Create a project at [supabase.com](https://supabase.com), then copy your
project URL and anon/public key into a local `.env`:

```bash
cp .env.example .env
```

```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

Never put your `SUPABASE_SERVICE_ROLE_KEY` in this file or anywhere in the
frontend — only the anon key is used client-side, and RLS does the rest.

### 3. Run the database migrations

In the Supabase SQL Editor (or via the Supabase CLI), run the files in
`supabase/migrations/` **in order**:

1. `0001_init.sql` — tables, indexes, triggers, and RLS policies
2. `0002_storage.sql` — a storage bucket + policies from an earlier iteration
   that included musical notation image uploads (since removed)
3. `0003_remove_notation_media.sql` — drops the bucket/table from (2); the
   notation-image feature isn't part of the product anymore

If you're using the Supabase CLI locally:

```bash
supabase link --project-ref your-project-ref
supabase db push
```

### 4. Create your first user

Supabase Auth doesn't have a public sign-up screen in this app (churches
provision accounts for their own staff). Create a user from **Authentication
→ Users → Add user** in the Supabase dashboard. A `profiles` row is created
automatically (via trigger) with the `presenter` role.

To make that user an admin (required to create/edit songs), open **Table
Editor → profiles** and change their `role` from `presenter` to `admin`.

### 5. (Optional) Load sample hymns

`supabase/seed.sql` inserts a handful of public-domain hymns (Amazing Grace,
Holy Holy Holy, Blessed Assurance, It Is Well with My Soul) plus a sample
worship set, so you have something to present immediately. Run it once
against your dev project via the SQL Editor.

### 6. Run the app

```bash
npm run dev
```

Sign in with the user you created, and you should land on the dashboard.

## Demo flow

1. Log in at `/login`
2. From the dashboard, click **Add Song** (admin only)
3. Fill in title/author/category, add a few sections (Verse 1, Chorus, ...)
4. Save the song
5. Click **Preview** to see it rendered on a simulated 16:9 projector canvas
6. Go to **Worship Sets → Create Worship Set**, add a few songs, reorder them
7. Click **Start Presentation**
8. In the Presenter view, click **Open Projector View** (send it to the
   actual projector display) and **Fullscreen** it there
9. Use `→` / `Space` / `←` to move through sections, `B` to black the
   screen, `F` to toggle fullscreen — the projector updates instantly

## Testing

Role-gating (what an `admin` vs. a `presenter` can see and do) is covered by
component tests using Vitest + React Testing Library, with a mocked Supabase
client so no real project or network access is needed:

```bash
npm run test        # run once
npm run test:watch  # watch mode
```

## Project structure

```
src/
  components/ui/       hand-rolled shadcn-style primitives (Button, Dialog, ...)
  components/layout/   AppShell (sidebar + header) for the admin/presenter app
  features/
    auth/               login, route protection
    dashboard/          dashboard + settings pages
    songs/              song list, preview, data access
    song-editor/        song CRUD form, section list, drag-and-drop
    worship-sets/       worship set CRUD, song picker, reordering
    presentation/        engine (BroadcastChannel, slide loader), presenter
                          controls, projector view, the 16:9 slide canvas
  stores/               Zustand: auth-store, presentation-store
  types/                Song/SongSection/WorshipSet/... types
  test/                 Vitest setup + a mock Supabase query-builder helper
supabase/
  migrations/           SQL schema + RLS + storage policies
  seed.sql              optional public-domain sample hymns
```

## Roles

- **admin** — everything, including creating/editing/deleting songs
- **presenter** — can view the hymnal, build and run worship sets, and
  control live presentations, but cannot edit the hymnal itself

## What's intentionally not built yet

Per the project's MVP scope: Bible/scripture presentation, announcement
slides, background video, live camera, remote/multi-device control, offline
database sync, the Tauri desktop shell, PDF/PowerPoint import, and MIDI/stage
display features. The architecture (a network-independent presentation
engine driven by `BroadcastChannel`) is built to make most of these additive
rather than requiring a rewrite.
