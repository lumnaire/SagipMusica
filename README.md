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

The database-side rules have their own checks, which apply the migrations to a
throwaway Postgres (PGlite) rather than mocking anything:

```bash
npm run event:check  # plays the 3-Text Hunt, tries to cheat at it, and
                     #   proves 0026 recovers a half-applied database
npm run bible:check  # 31,102 verses land intact, and the queries stay fast
npm run map:check    # the location matcher agrees with itself at scale
```

## Project structure

```
src/
  components/ui/       hand-rolled shadcn-style primitives (Button, Dialog, ...)
  components/layout/   AppShell (sidebar + header), LoadingScreen
  features/
    auth/               login, signup, route protection
    onboarding/         church creation + spotlight tour trigger
    map/                the pin map: gazetteer-backed API, the projection, and
                          the generated SVG world it is drawn on
    marketing/           landing page, nav, footer, the Pro event banner
    dashboard/          dashboard + settings pages
    download/           desktop download page + the pre-download survey
    songs/              song list, preview, shared library, data access
    song-editor/        song CRUD form, section list, drag-and-drop
    encoder/            shared song library editor (platform role)
    superadmin/         platform stats, account + role management
    worship-sets/       worship set CRUD, song picker, reordering
    presentation/        engine (BroadcastChannel, slide loader), presenter
                          controls, projector view, the 16:9 slide canvas
    bible/              scripture picker, reference parser, verse search
    event/              the 3-Text Hunt (web only): the announcement bar, the
                          board and its dialog, the countdown, the
                          hidden-word probe, the winner celebration
  stores/               Zustand: auth-store, church-store, presentation-store,
                          bible-store (the event keeps its own, in features/)
  types/                Church/Profile/Song/... types
  test/                 Vitest setup + a mock Supabase query-builder helper
supabase/
  migrations/           SQL schema + RLS + storage policies
  seed.sql              notes on why there's no global seed data anymore
scripts/
  generate-hymnal-migration.mjs   regenerates 0013 from the FBC hymnal JSON
  generate-world-map.mjs          regenerates the SVG world + country gazetteer
  inline-country-places.mjs       pastes that gazetteer into 0018
  check-map-migration.mjs         runs 0018 against a throwaway Postgres
  generate-bible-migration.mjs    regenerates 0021 from the KJV source JSON
  check-bible-migration.mjs       runs 0020+0021 against a throwaway Postgres
  check-event-migration.mjs       plays the 3-Text Hunt against a throwaway
                                    Postgres, and tries to cheat at it
  build-bible-seed.mjs            regenerates the desktop's copy of the Bible
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

## The Bible

The whole King James Version — the 1769 Blayney revision, public domain — lives in
our own database: `bible_books`, `bible_verses` and `bible_translations`, added by
`0020_bible.sql`. **No API call is ever made to read a verse.** Putting somebody
else's uptime and rate limit in the path of scripture going on the screen mid-sermon
is not acceptable in buildings whose internet is a phone hotspot, and it is why the
desktop build will be able to ship the same rows in a local file and behave
identically offline.

`0021_bible_kjv_verses.sql` is **generated** and holds all 31,102 verses — edit
`scripts/generate-bible-migration.mjs` and re-run `npm run bible:generate` rather
than hand-editing 5MB of SQL. It applies two transformations, both documented in the
script's header: the source's paragraph pilcrows become the `paragraph` column, and
the brackets it puts around words supplied by the translators are dropped, because
on a sanctuary screen they read as a typo.

`npm run bible:check` applies both migrations to a throwaway Postgres and verifies
**all 1,189 chapters** against an independent transcription of the KJV, plus a set of
landmark verses, the search, and that scripture is read-only — there are select
policies and no others, so no signed-in user and no admin can write a word of it.
The per-chapter table it checks against came from a different transcription by
different people, so it is a real cross-check rather than the import agreeing with
itself.

### Reading more than 1,000 rows

`bible_chapters` is 1,189 rows, and **PostgREST caps a response at 1,000 by default
and does it silently** — the request succeeds, `error` is null, and you are handed a
prefix. Because the rows come back in canonical order, the half that vanished was
the end of the Bible: the picker showed John stopping at chapter 3 and Acts through
Revelation with no chapters at all, while the database was complete the whole time.
`fetchChapterIndex` therefore pages, taking its page size from what the server
actually returned rather than from a constant, with `count` as a definite target.
Anything else here that can outgrow 1,000 rows needs the same treatment.

Translations are a **table**, not a column, even though only the KJV is seeded. Ang
Dating Biblia is going to be asked for; adding it should be an insert plus a
generated verse file, not a schema change.

The desktop build ships the same verses in SQLite. `npm run bible:seed` **applies**
these migrations to a throwaway Postgres and reads the rows back out into
`desktop/resources/bible-seed.json`, rather than parsing 5MB of generated SQL by
hand — so the two builds are serving the same scripture by construction. Re-run it
whenever `0021` changes.

### Finding a passage

One box does both jobs, because a presenter should not have to decide which one they
are doing before they start typing. Anything that reads as a reference —
`jn 3:16`, `Psalm 23`, `I John 4:7-8` — jumps there; anything else is searched as
words against a Postgres full-text index. `src/features/bible/reference.ts` tells
them apart, and the book spellings it matches live in the database (`bible_books.aliases`)
so the desktop build can parse against the same rows.

Scripture presents as **one verse per slide**, so the presenter advances in step with
whoever is reading aloud and the reference on screen is always exact. From a running
presentation, the **Bible** button adds a passage to the end without cutting to it —
there is one cursor in the engine and it is the live one, so jumping would put the
verse on the sanctuary screen in the middle of the current song.

## The pin map

The landing page closes on a live map of where SagipMusica is being used. There
is no data entry behind it: it reads the location answers the product already
collects — onboarding step 2 (`churches.location`) and the desktop download
survey (`download_signups.church_location`) — so a church that finishes
onboarding is on the map on the next load, and so is every desktop install.

Free text becomes a point through a **gazetteer**, not a geocoding API.
`0018_map_pins.sql` ships every country plus every Philippine province, and
`match_map_place()` resolves an answer against their names and aliases. It reads
"Cebu City, Philippines", "Quezon City", "Cagayan de Oro" and "Gensan" correctly,
and it deliberately cannot place a barangay — the pin says "a church in Cebu",
which is as precise as the answers are and as much as should be published.
Counts are derived by query rather than stored, so duplicate spellings collapse
onto one pin by construction and nothing can drift out of step.

The superadmin dashboard has the other half: a review table showing what people
typed next to what it was read as, with the ability to reassign a misread
answer, keep one off the map, hide a pin, or drop a new one anywhere by clicking
the map.

The world itself is **generated** — `npm run map:generate` rebuilds
`src/features/map/world-geometry.ts` and the country rows in 0018 from Natural
Earth. It is a self-contained SVG rather than a tile layer because `vercel.json`
restricts `img-src` to `'self'`, and a basemap is not worth widening the CSP
for. `npm run map:check` applies 0018 to an in-process Postgres and asserts the
matcher against ~60 real spellings.

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

## The 3-Text Hunt event

A scavenger hunt on every signed-in dashboard. Three code words — `[SAGIP]`,
`[MUSICA]` and `[PRO]` — are hidden on three different screens; the first five
accounts to find all three **in order** keep SagipMusica Pro permanently.

It runs for exactly one week — **14 to 21 September 2026, 8am Philippine time** —
and is announced, with a countdown and a Join button, from the moment the
migration is applied. The card also carries a QR code and a copy-link button for
pulling the rest of the AV team in, because three riddles in three corners of
the app go faster with a media team than alone.

Everything that decides anything lives in `0023_text_hunt_event.sql`. The client
is never told where a word is hidden — it works the other way round. As the user
moves through the app, each participating screen *asks*:

```
event_probe('bible-chapter', '65:1')   -- "am I standing on anything?"
```

and the server answers yes or no. The answer keys are in `event_challenges`,
which has no `SELECT` grant to `anon` or `authenticated`: there is no request a
browser can make that returns them. Building the app and grepping the bundle for
`Jesus Saves`, `Jude` or `65:1` finds nothing — only the three slot names, which
is roughly what the riddles say out loud anyway.

The same applies to the rest of it:

- **The countdown** is drawn from the server's clock (`event_state()` returns
  `server_now`), so a wound-forward machine clock or an edited DOM changes a
  number on screen and nothing else. `event_probe` and `event_claim` refuse
  before the start.
- **The order** is enforced per claim: level *N* is refused unless levels
  1..*N*-1 are already solved. Locked levels do not even release their riddle.
- **`[MUSICA]` moves.** Its hiding place rotates every time somebody solves it —
  Jude, Psalm 51, Matthew 1, Revelation 1, then round again — so an answer
  forwarded to a group chat is stale by the time the next person tries it. A
  player who was *shown* a target keeps a ten-minute grace window on it, so
  being beaten to the click by a stranger is not a loss.
- **The prize** is handed out under a row lock on the settings row, so five
  slots stay five. `profiles.subscription` is written by the function, not the
  client — a trigger rejects any update to that column arriving as the
  `authenticated` role, which is what stops a one-line `PATCH` granting Pro.
- **Brute force** is budgeted: 90 probes a minute, and a cool-off after a run of
  wrong claims.
- **The close** is the same kind of gate as the start. Once `ends_at` passes,
  `event_hunt_open()` is false for everyone — preview accounts included, which
  is the one place preview does *not* get an exemption — and `event_state()`
  returns `visible: false`, the single check the dashboard card reads before it
  renders anything. The board leaves every dashboard on its own.

Nothing is deleted when the week is up. `event_solves`, the winner ranks and
`profiles.subscription` all stay exactly as they were: the prize lives on the
profile, not on the card, so a winner keeps their `PRO` tag after the board has
gone. The card says so in as many words before it disappears — both in the
closing notice under the countdown and in the panel a finisher sees.

To move or test the window:

```sql
-- close it now (the board vanishes on the next dashboard load)
update event_settings set ends_at = now() - interval '1 minute' where id = 1;
-- reopen it for another week
update event_settings set ends_at = now() + interval '7 days' where id = 1;
-- back to the shipped dates
update event_settings set starts_at = default, ends_at = default where id = 1;
```

The window is **08:00 to 08:00 Philippine time** (migration 0028) — still
exactly seven days, but it no longer opens and closes while the country is
asleep. Both the column defaults and the deployed row are set, so
`set starts_at = default` — which the rehearsal instructions use to undo a test
— restores the right window rather than the old midnight one.

Switching `preview_enabled` off **revokes previews already held**, not just
future ones. That distinction is worth five permanent Pro accounts: without it,
every account used in testing stays inside the hunt and can finish it weeks
before anyone else can reach it. `npm run event:check` asserts the revocation.

`npm run event:check` applies every event migration to a throwaway Postgres and plays
the hunt as several accounts at once — including every shortcut worth trying.
It runs as the `authenticated` role throughout, which is what a browser gets.

### Where it lives on the dashboard

Behind a **Limited Event** quick action, beside "Add Song" and "Create Worship
Set" — not as a card in the page. As a card it was full width and half a screen
tall, which pushed the stats, the quick actions and the recent songs below the
fold: the wrong trade for something that runs a week and then leaves. The button
carries its state at a glance (`New`, `1/3`, `Done`) and removes itself entirely
once the event closes, so the row has no gap where it used to be.

Nothing else changes with that move. Challenge 3 is still the word "Pro" in the
board's headline; being inside a dialog changes nothing about what the server
answers.

### How the event announces itself

A dismissible bar across the top of the dashboard, scrolling its message on a
loop: *SagipMusica Pro is around the corner — and we've prepared a limited event
just for you. Find it under Quick Actions, then hit Join to see who else is
playing and reserve your slot.* It pauses on hover, because reading "where do I
find it" off a moving line is a chore.

This replaced a full-screen celebration that fired on first sign-in. The
celebration worked, but it landed on people who had just finished the
walkthrough and wanted to get on with their Sunday — an interruption for a
promotion, which is the wrong shape for something a church opens on a Saturday
night to build a service order.

Dismissal is remembered server-side, on the same `event_announcement_seen` row
the celebration used (migration 0025) — so it is once per account, not once per
browser, and closing it on the office desktop keeps it closed on the tablet at
the sound desk. To show it again: `delete from event_announcement_seen
where user_id = '<uuid>'`.

The walkthrough now says nothing about the event at all. It teaches the app;
the bar does the promoting.

### If the event does not appear after running the SQL

Run **`0026_text_hunt_repair.sql`**. It re-asserts the whole feature at its
final shape, is safe to run any number of times, and ends with a diagnostic
`SELECT` that answers "is it on, and why not" — read that output rather than
guessing.

Two things it fixes, both of which leave every table and row perfectly intact
while the event vanishes from the app:

- **Migrations applied out of order.** 0023, 0024 and 0025 each redefine the
  *whole* of `event_state()`, because each adds a field. Run 0023 last — easy
  when pasting a folder of files into the SQL editor — and the function reverts
  to the version with no `visible` in it. The dashboard reads `visible` as
  undefined and renders nothing. `npm run event:check` reproduces this exact
  failure and proves 0026 recovers from it.
- **PostgREST's schema cache.** A function the API has not noticed yet returns
  404 to the browser exactly as if it did not exist. 0026 ends with
  `notify pgrst, 'reload schema'`.

The client also defends itself: `normalize()` in `features/event/api.ts` fills
in `visible` and `announcement_seen` when an older `event_state()` omits them,
so a half-applied database degrades instead of going blank. That is a
stopgap — run 0026 to put the server right.

### If the walkthrough does not appear

It runs once per account and marks itself done on the way out — including when
it is dismissed with Esc or a click outside — so the first thing to rule out is
that it simply already ran. There is a **Replay the walkthrough** button in
Settings for exactly that: one click, no SQL, and it makes "it never appeared"
answerable instead of indistinguishable from "it was dismissed by accident".

Three failure modes have been removed from it, all of which looked identical
from the outside — nothing happens, no error, and the account is marked
onboarded so it never comes back:

- **The dynamic import.** `driver.js` was loaded with `await import()`, which
  put an async gap between "this account needs the walkthrough" and the
  walkthrough existing. Anything going wrong in that gap — a rejected chunk
  request, an unmount landing mid-flight — failed silently and permanently. It
  is a plain top-level import now; seven kilobytes gzipped is not worth a
  first-run experience that can vanish without trace. Failures are caught,
  logged, and leave the account eligible to try again.

- **Waiting on the event.** The tour briefly waited for `event_state()` so its
  last step could point at the Limited Event button. That made a slow or failing
  promotional endpoint capable of taking the entire first run down with it. The
  tour no longer references the event in any way.

- **Hidden anchors.** Five steps point into the sidebar, which is
  `hidden md:block` — in the DOM at every width, `display: none` below 768px.
  Highlighting those gives popovers nothing to attach to. Steps are filtered by
  computed style, and — importantly — if that filter would leave nothing, the
  unfiltered list is used anyway. The filter is an improvement, not a gate: a
  walkthrough that declines to run looks exactly like one that is broken.

`DashboardPage.onboarding.test.tsx` pins all of it, including that every step
anchors to an element that is really on the page.

### On the landing page

`ProEventSection` sits directly after the hero, with a golden key flanking the
copy on each side (they step out of the way below `lg`, where two decorative
images either side of a paragraph would leave the paragraph unreadable). It is
the only thing on that page with a deadline, and it removes itself when the hunt
closes.

That is the one place `event_state()` is granted to `anon`. The signed-out branch
returns before it touches a single account-scoped query and hands back five
public facts — is it on, when does it open, when does it close, has it started,
how many joined — which is the same class of endpoint as `public_platform_stats()`.
`event_probe`, `event_claim`, `event_join` and `event_ack_announcement` all stay
`authenticated`-only, and the check script asserts each of those refusals.

### Web only

The hunt is a hosted-app feature: it needs accounts to award a prize to, one
shared clock, and a server to hold the answers — none of which exist in the
desktop build. There is **no event on desktop**, and three small things in
`desktop/` exist purely to keep it that way:

- `renderer/data/event.ts` — a stand-in that reports the event as switched off.
- one line in `electron.vite.config.ts` aliasing `@/features/event/api` to it.
- two fields in `toProfile()`, because `Profile` gained `subscription`.

These are load-bearing, not optional. The song editor and the Bible browser are
shared with the web app verbatim and both import the event's client module, so
without the alias the desktop renderer pulls in the Supabase client — which
throws at module load in a build that has no Supabase, taking the whole renderer
down with it (a white screen on launch, not a degraded page). Without the
`toProfile` fields, `npm run typecheck` in `desktop/` fails outright. Reverting
any of the three does not remove the event from desktop; it breaks desktop.

### Rehearsing the hunt

The localhost **Start** and **Reset** buttons are gone, and `preview_enabled`
now ships **off** (migration 0027) — removing the buttons without closing the
RPCs would have made things worse, not better, since
`event_start_preview()` is an endpoint and not a button.

Rehearse by moving the window instead. It exercises the real clock-driven path
rather than a bypass, which is the thing actually worth rehearsing:

```sql
-- open it now, for an hour
update event_settings
   set starts_at = now(), ends_at = now() + interval '1 hour'
 where id = 1;

-- put it back
update event_settings set starts_at = default, ends_at = default where id = 1;
```

To replay an account's hunt, clear its progress by hand:

```sql
delete from event_solves            where user_id = '<uuid>';
delete from event_participants      where user_id = '<uuid>';
delete from event_announcement_seen where user_id = '<uuid>';
update profiles set subscription = 'free', subscription_granted_at = null
 where id = '<uuid>';
```

To pull the whole thing off the dashboard, set `is_active = false` on the
settings row.

Note that challenge 1 hides `[SAGIP]` on the song editor, which is
`admin`-only — a `presenter` can join and see the riddles but cannot reach
that screen.

## Subscription tiers

Every account carries `profiles.subscription`, defaulting to `free`. It is not
writable from the client (see above); `pro` is awarded by `event_claim()` and by
SQL. A Pro account shows a `PRO` tag beside its name in the sidebar. No feature
is gated on it yet — the tier exists so that when Pro ships, the question "what
does a Pro account see" already has somewhere to be asked.

Free is not a trial. The plan every church is on today keeps the hymnal, worship
sets, the built-in Bible and live presentation after the event and after Pro
ships; Pro is additive.

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
