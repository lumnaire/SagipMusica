# Worship Presenter

A church worship presentation & hymnal management system. Songs aren't just
lyrics — every stanza can carry its own musical notation image (cropped just
for the projector), its own lyrics, and its own place in a worship set. Built
for church staff and volunteer worship teams, not developers.

## Tech stack

- React + Vite + TypeScript (strict)
- Tailwind CSS v4 + hand-rolled shadcn-style components (Radix UI primitives)
- Supabase (Postgres, Auth, Storage, Row Level Security)
- Zustand for presentation/session state
- `react-easy-crop` for the notation image crop editor
- `@dnd-kit` for drag-and-drop reordering
- Browser Fullscreen API + `BroadcastChannel` for presenter → projector sync

## Architecture

The presentation engine (`src/features/presentation/engine`) is deliberately
decoupled from the admin UI:

```
Supabase (Auth, Postgres, Storage)
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
2. `0002_storage.sql` — the `presentation-media` storage bucket + policies

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

To make that user an admin (required to create/edit songs and upload
notation), open **Table Editor → profiles** and change their `role` from
`presenter` to `admin`.

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
2. From the dashboard, click **Add Song**
3. Fill in title/author/category, add a few sections (Verse 1, Chorus, ...)
4. Save the song — this persists it and unlocks notation upload per section
5. On a section, click **Upload Musical Notes**, then **Edit Crop** to frame
   just the notation for the projector
6. Click **Preview** to see it rendered on a simulated 16:9 projector canvas
7. Go to **Worship Sets → Create Worship Set**, add a few songs, reorder them
8. Click **Start Presentation**
9. In the Presenter view, click **Open Projector View** (send it to the
   actual projector display) and **Fullscreen** it there
10. Use `→` / `Space` / `←` to move through sections, `B` to black the
    screen, `F` to toggle fullscreen — the projector updates instantly

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
    media-editor/        notation upload + crop editor (react-easy-crop)
    worship-sets/       worship set CRUD, song picker, reordering
    presentation/        engine (BroadcastChannel, slide loader), presenter
                          controls, projector view, the 16:9 slide canvas
  stores/               Zustand: auth-store, presentation-store
  types/                Song/SongSection/SectionMedia/WorshipSet/... types
supabase/
  migrations/           SQL schema + RLS + storage policies
  seed.sql              optional public-domain sample hymns
```

## Roles

- **admin** — everything, including creating/editing/deleting songs and
  uploading notation images
- **presenter** — can view the hymnal, build and run worship sets, and
  control live presentations, but cannot edit the hymnal itself

## What's intentionally not built yet

Per the project's MVP scope: Bible/scripture presentation, announcement
slides, background video, live camera, remote/multi-device control, offline
database sync, the Tauri desktop shell, PDF/PowerPoint import, and MIDI/stage
display features. The architecture (a network-independent presentation
engine driven by `BroadcastChannel`) is built to make most of these additive
rather than requiring a rewrite.
