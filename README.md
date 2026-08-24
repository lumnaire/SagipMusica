# SagipMusica

A multi-tenant worship presentation & hymnal management system: any church
can sign up and get its own workspace to manage a hymnal of songs and
stanzas, group them into worship sets, and run a distraction-free 16:9
presentation on a projector, synced live from a presenter view.

## Tech stack

- React + Vite + TypeScript (strict)
- Tailwind CSS v4 + hand-rolled shadcn-style components (Radix UI primitives)
- Supabase (Postgres, Auth, Row Level Security) — multi-tenant, scoped by
  `church_id`
- Zustand for auth/church/presentation/session state
- `@dnd-kit` for drag-and-drop reordering
- `framer-motion` for the landing page hero, `driver.js` for the onboarding
  tour
- Browser Fullscreen API + `BroadcastChannel` for presenter → projector sync

## Architecture

The presentation engine (`src/features/presentation/engine`) is deliberately
decoupled from the admin UI:

```
Supabase (Auth, Postgres, RLS scoped by church_id)
        │
        ▼
  Admin / Presenter app  ──BroadcastChannel──▶  Projector window
  (loads slides from DB,                        (renders whatever it's
   controls the session)                         told, no network calls)
```

The Presenter window is the only thing that talks to Supabase during a live
service. Once a presentation starts, slide changes are pushed to the
Projector window over `BroadcastChannel` — no network round-trip per slide,
and the projector output stays completely free of admin UI.

Every church's data (`songs`, `song_sections`, `worship_sets`,
`worship_set_items`) is isolated by a `church_id` column enforced through
Row Level Security — see `supabase/migrations/0004_multitenant_rebuild.sql`.

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
`supabase/migrations/` **in order**. `0004_multitenant_rebuild.sql` is a full
wipe-and-rebuild of the schema — it drops everything from `0001`-`0003` and
recreates it multi-tenant. If you're starting fresh, you technically only
need to run `0004`, but running them in order documents how the schema got
here.

If you're using the Supabase CLI locally:

```bash
supabase link --project-ref your-project-ref
supabase db push
```

### 4. Configure auth providers

- **Email/password**: Authentication → Providers → Email, confirm "Confirm
  email" is enabled so new signups go through email verification.
- **Google OAuth**: create an OAuth client in Google Cloud Console, then
  paste the Client ID/Secret into Authentication → Providers → Google. Set
  the authorized redirect URI to
  `https://<project-ref>.supabase.co/auth/v1/callback`.
- Either way, set your app's origins under Authentication → URL
  Configuration (Site URL + redirect allow-list), e.g.
  `http://localhost:5173/dashboard` for local dev.

### 5. Run the app

```bash
npm run dev
```

Sign up at `/signup` (or `/login` if you already have an account). New
accounts land in onboarding, where creating a church automatically makes
that user its admin and generates their dashboard.

## Demo flow

1. Sign up at `/signup`, verify your email (or continue with Google)
2. Complete onboarding — name your church and tell us where you heard about
   SagipMusica
3. Land on your dashboard, take the guided tour
4. Click **Add Song** (admin only), fill in title/author/category, add a few
   sections (Verse 1, Chorus, ...), save
5. Click **Preview** to see it rendered on a simulated 16:9 projector canvas
6. Go to **Worship Sets → Create Worship Set**, add a few songs, reorder them
7. Click **Start Presentation**
8. In the Presenter view, click **Open Projector View** (send it to the
   actual projector display) and **Fullscreen** it there
9. Use `→` / `Space` / `←` to move through sections, `B` to black the
   screen, `F` to toggle fullscreen — the projector updates instantly

## Testing

Role-gating and church-gating (what an `admin` vs. a `presenter` can see and
do, and what happens before/after onboarding) are covered by component tests
using Vitest + React Testing Library, with a mocked Supabase client so no
real project or network access is needed:

```bash
npm run test        # run once
npm run test:watch  # watch mode
```

## Project structure

```
src/
  components/ui/       hand-rolled shadcn-style primitives (Button, Dialog, ...)
  components/layout/   AppShell (sidebar + header), LoadingScreen
  features/
    auth/               login, signup, route protection
    onboarding/         church creation + spotlight tour trigger
    marketing/           landing page, nav, footer
    dashboard/          dashboard + settings pages
    download/           desktop download page + the pre-download survey
    songs/              song list, preview, shared library, data access
    song-editor/        song CRUD form, section list, drag-and-drop
    encoder/            shared song library editor (platform role)
    superadmin/         platform stats, account + role management
    worship-sets/       worship set CRUD, song picker, reordering
    presentation/        engine (BroadcastChannel, slide loader), presenter
                          controls, projector view, the 16:9 slide canvas
  stores/               Zustand: auth-store, church-store, presentation-store
  types/                Church/Profile/Song/... types
  test/                 Vitest setup + a mock Supabase query-builder helper
supabase/
  migrations/           SQL schema + RLS + storage policies
  seed.sql              notes on why there's no global seed data anymore
scripts/
  generate-hymnal-migration.mjs   regenerates 0013 from the FBC hymnal JSON
docs/
  hymnal-copyright-review.md      which imported hymns ship without lyrics, and why
```

## The shared song library

`hymn_templates` is a platform-wide catalog, separate from any church's `songs`.
An encoder maintains it; admins copy songs out of it at `/songs/library`, and the
copy is theirs from that moment on.

It holds two things: the original 20 starter hymns (`is_starter = true`, given to
every new church automatically at signup), and the 399-hymn FBC hymnal imported by
`0013_fbc_hymnal.sql`, which is browse-only so a new church doesn't open a hymnal
with 419 songs in it.

The desktop build does the opposite — it copies the whole library into the hymnal
on first launch and has no library page at all. The reasoning is in
[desktop/README.md](desktop/README.md#the-hymnal).

`0013` is **generated** — edit `scripts/generate-hymnal-migration.mjs` and re-run it
rather than hand-editing the SQL. 21 hymns whose words are still under copyright are
imported as metadata only, with no lyrics; see
[docs/hymnal-copyright-review.md](docs/hymnal-copyright-review.md), which also lists
the titles that still need a human check.

## Roles

Church roles — these belong to one church and see only that church's data:

- **admin** — everything, including creating/editing/deleting songs, and
  updating church branding. The user who completes onboarding for a church
  becomes its admin.
- **presenter** — can view the hymnal, build and run worship sets, and
  control live presentations, but cannot edit the hymnal itself

Platform roles — these have no `church_id` and sit outside the tenant model, so
they can never read or write any church's songs:

- **superadmin** — sees platform-wide counts and every account, can delete
  accounts, and can promote a church-less account to encoder. Granted by SQL
  only (see `0011_superadmin.sql`).
- **encoder** — maintains the shared song library at `/encoder`: adds songs,
  keeps them as drafts, and publishes them. Church admins browse the published
  catalog at `/songs/library` and copy songs into their own hymnal, where the
  copy becomes theirs to edit — later library edits never touch it. Granted by
  a superadmin from `/superadmin` (see `0012_song_encoder.sql`).

## What's intentionally not built yet

Inviting teammates to join an existing church, Bible/scripture presentation,
announcement slides, background video, live camera, remote/multi-device
control, offline database sync, a desktop shell, PDF/PowerPoint import, and
MIDI/stage display features. The architecture (a network-independent
presentation engine driven by `BroadcastChannel`, and a `church_id`-scoped
schema) is built to make most of these additive rather than requiring a
rewrite.

## Licence

[MIT](LICENSE) — use it, fork it, ship it, sell it; just keep the copyright
notice.

One thing the licence does not cover: the hymn texts. Everything shipped here
is believed to be public domain, and the hymns whose words are still under
copyright are included as metadata only, with no lyrics — see
[docs/hymnal-copyright-review.md](docs/hymnal-copyright-review.md). If you add
hymn texts to a fork, their licensing is yours to sort out.
