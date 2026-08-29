// Runs the 3-Text Hunt against a throwaway Postgres and tries to cheat at it.
//
//   npm run event:check
//
// PGlite is real Postgres compiled to wasm, so the row locks, the RLS and the
// SECURITY DEFINER boundary behave the way they will in Supabase. What it does
// not have is Supabase's own schema, so the stub below builds the small part
// of it that 0023 leans on -- auth.uid(), profiles, and the tables the
// superadmin counters read.
//
// What it is guarding:
//
//   The event is the only thing in this codebase where a user has a concrete
//   incentive to break it: five permanent Pro accounts, handed to whoever
//   finishes first. Every rule that stands between a player and that prize
//   lives in SQL rather than in the client (see the migration's header for
//   why), which means the client cannot be the thing that tests them.
//
//   So this walks the hunt as several accounts at once, and between the
//   honest moves it tries every shortcut worth trying: claiming out of order,
//   claiming before the countdown, replaying an answer somebody else already
//   used, sweeping the Bible for the one chapter that answers yes, and
//   writing 'pro' straight into the profiles row.
//
// It runs as the `authenticated` role throughout, which is what a browser gets
// through PostgREST. Anything that passes here as postgres and fails here as
// authenticated is exactly the kind of hole this exists to find.
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

/**
 * The parts of Supabase that 0023 is written against.
 *
 * auth.uid() reads a GUC here rather than a JWT, which is the same mechanism
 * Supabase uses -- PostgREST sets request.jwt.claim.sub per request and the
 * real auth.uid() reads it back. Setting it directly is how this script
 * "signs in" as one account or another.
 */
const STUB = `
  do $$ begin
    if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon; end if;
    if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated; end if;
  end $$;

  create schema if not exists auth;
  create table auth.users (
    id uuid primary key default gen_random_uuid(),
    last_sign_in_at timestamptz,
    email_confirmed_at timestamptz
  );

  create or replace function auth.uid() returns uuid
  language sql stable as $$
    select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
  $$;
  grant usage on schema auth to anon, authenticated;
  grant execute on function auth.uid() to anon, authenticated;

  create table churches (id uuid primary key default gen_random_uuid(), name text);

  create table profiles (
    id uuid primary key references auth.users (id) on delete cascade,
    church_id uuid references churches (id) on delete set null,
    email text not null,
    name text,
    role text not null default 'presenter',
    onboarding_completed boolean not null default false,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
  );

  alter table profiles enable row level security;
  grant select, update on table profiles to authenticated;

  -- The policy 0023 has to work around: an account may edit its own row.
  create policy "profiles_select_own" on profiles
    for select to authenticated using (id = auth.uid());
  create policy "profiles_update_self" on profiles
    for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

  create or replace function is_superadmin() returns boolean
  language sql security definer stable set search_path = public as $$
    select exists (select 1 from profiles where id = auth.uid() and role = 'superadmin');
  $$;

  -- Read only by the superadmin counters at the end of the migration.
  create table songs (id uuid primary key default gen_random_uuid());
  create table worship_sets (id uuid primary key default gen_random_uuid());
  create table hymn_templates (id uuid primary key default gen_random_uuid(), status text default 'published');
  create table download_signups (id uuid primary key default gen_random_uuid());
`;

let failures = 0;
const fail = (message) => {
  failures++;
  console.log(`  FAIL  ${message}`);
};
const ok = (message) => console.log(`  ok    ${message}`);
const check = (condition, message) => (condition ? ok(message) : fail(message));

const db = await PGlite.create();
await db.exec(STUB);
for (const migration of [
  "0023_text_hunt_event.sql",
  "0024_text_hunt_end_date.sql",
  "0025_text_hunt_announcement.sql",
  // Applied last on purpose: it is the repair file, and re-asserting the final
  // shape on top of an already-correct database is exactly what it claims to
  // be safe to do.
  "0026_text_hunt_repair.sql",
  "0027_text_hunt_go_live.sql",
  "0028_text_hunt_window_8am.sql",
]) {
  await db.exec(readFileSync(resolve(ROOT, "supabase/migrations", migration), "utf8"));
}
console.log("\n0023 -> 0028 applied");

// 0027 shuts the preview door for production. Assert it is shut as shipped,
// then prop it open for the rest of this run -- the hunt opens on 14 September
// 2026 and preview is the only way to play it before then.
const shipped = (await db.query(`select preview_enabled from event_settings where id = 1`))
  .rows[0];
check(
  shipped.preview_enabled === false,
  "preview ships OFF, so nobody can start the hunt early through the RPC",
);
await db.exec(`update event_settings set preview_enabled = true where id = 1`);

const one = async (sql, params) => (await db.query(sql, params)).rows[0];

/** Sign in as an account, as the role a browser would arrive with. */
async function signIn(userId) {
  await db.exec(`reset role`);
  await db.query(`select set_config('request.jwt.claim.sub', $1, false)`, [userId]);
  await db.exec(`set role authenticated`);
}

async function makeAccount(email) {
  await db.exec(`reset role`);
  const { id } = await one(`insert into auth.users default values returning id`);
  await db.query(`insert into profiles (id, email) values ($1, $2)`, [id, email]);
  return id;
}

const rpc = async (fn, params = []) => {
  const args = params.map((_, i) => `$${i + 1}`).join(", ");
  return (await db.query(`select ${fn}(${args}) as r`, params)).rows[0].r;
};

/** Swallows the error and reports whether one happened -- several checks want that. */
async function refused(sql, params = []) {
  try {
    await db.query(sql, params);
    return false;
  } catch {
    // PGlite leaves the transaction aborted; the role survives a rollback.
    await db.exec(`rollback`).catch(() => {});
    return true;
  }
}

// The answers. This script is allowed to know them; nothing shipped to a
// browser is. If these ever have to change, they change in the migration and
// this file follows -- not the other way round.
const JESUS_SAVES = "Jesus Saves";
const ROTATION = ["65:1", "19:51", "40:1", "66:1"]; // Jude, Ps 51, Matt 1, Rev 1

// ---------------------------------------------------------------------------
// 1. The countdown is a server-side gate, not a display
// ---------------------------------------------------------------------------

console.log("\ncountdown");

const alice = await makeAccount("alice@example.test");
await signIn(alice);

const before = await rpc("event_state");
check(before.active === true, "the event is active");
check(before.has_started === false, "has_started is false ahead of 14 Sep 2026");
check(before.joined === false, "a new account has not joined");
check(
  typeof before.server_now === "string",
  "state carries the server's own clock for the countdown to run from",
);
check(
  JSON.stringify(before).includes("Jesus") === false &&
    JSON.stringify(before).includes("65:1") === false,
  "state leaks no answer, only progress",
);

await rpc("event_join");
const joined = await rpc("event_state");
check(joined.joined === true, "join() enrols the account");
check(joined.hunt_open === false, "joining does not open the hunt early");

// The interesting one: standing on the right answer before the start.
const early = await rpc("event_probe", ["song-editor", JESUS_SAVES]);
check(early.present === false, "probing the correct answer before the start finds nothing");

const earlyClaim = await rpc("event_claim", ["song-editor", JESUS_SAVES]);
check(
  earlyClaim.ok === false && earlyClaim.reason === "not_open",
  "claiming the correct answer before the start is refused",
);

// ---------------------------------------------------------------------------
// 2. Order is enforced, and only the current level's slot answers
// ---------------------------------------------------------------------------

console.log("\nordering");

await rpc("event_start_preview");
const open = await rpc("event_state");
check(open.hunt_open === true, "preview opens the hunt for this account only");

const challenges = open.challenges;
check(
  challenges[0].status === "open" && challenges[0].prompt !== null,
  "challenge 1 is open and its riddle is released",
);
check(
  challenges[1].status === "locked" && challenges[1].prompt === null,
  "challenge 2 is locked and its riddle is withheld",
);
check(
  challenges[2].status === "locked" && challenges[2].prompt === null,
  "challenge 3 is locked and its riddle is withheld",
);

// Knowing where [MUSICA] and [PRO] are is worth nothing on level 1.
const skip2 = await rpc("event_claim", ["bible-chapter", ROTATION[0]]);
check(skip2.ok === false && skip2.reason === "wrong", "level 2's answer is refused on level 1");
const skip3 = await rpc("event_claim", ["event-word", "pro"]);
check(skip3.ok === false && skip3.reason === "wrong", "level 3's answer is refused on level 1");

await db.exec(`reset role`);
const noSolves = await one(`select count(*)::int as n from event_solves`);
check(noSolves.n === 0, "no solve was recorded by any of that");
await signIn(alice);

// ---------------------------------------------------------------------------
// 3. Level 1 -- the right song, and only the right song
// ---------------------------------------------------------------------------

console.log("\n[SAGIP]");

const wrongSong = await rpc("event_probe", ["song-editor", "Amazing Grace"]);
check(wrongSong.present === false, "the wrong song hides nothing");

const rightSong = await rpc("event_probe", ["song-editor", JESUS_SAVES]);
check(
  rightSong.present === true && rightSong.code_word === "SAGIP",
  "the right song reveals [SAGIP]",
);
check(
  rightSong.level === 1 && rightSong.answer_key === undefined,
  "the reveal carries the word and nothing that helps with level 2",
);

const caseInsensitive = await rpc("event_probe", ["song-editor", "  jESUS   saves "]);
check(
  caseInsensitive.present === false,
  "an inner-whitespace variant is not the title (trim and lower only)",
);
check(
  (await rpc("event_probe", ["song-editor", "  JESUS SAVES  "])).present === true,
  "case and surrounding whitespace do not matter",
);

const claim1 = await rpc("event_claim", ["song-editor", JESUS_SAVES]);
check(claim1.ok === true && claim1.completed === false, "claiming [SAGIP] advances the account");
check(
  (await rpc("event_state")).current_level === 2,
  "the account is now on level 2",
);
check(
  (await rpc("event_probe", ["song-editor", JESUS_SAVES])).present === false,
  "[SAGIP] is gone from the song once found",
);

// ---------------------------------------------------------------------------
// 4. Level 2 -- the word moves, which is the whole point of it
// ---------------------------------------------------------------------------

console.log("\n[MUSICA]");

check(
  (await rpc("event_probe", ["bible-chapter", ROTATION[0]])).present === true,
  `the first player finds [MUSICA] at ${ROTATION[0]} (Jude)`,
);

// The sweep a script would do. 66 books is well inside the probe budget, so
// this is a genuine attempt rather than a throttled one.
let hits = 0;
for (let book = 1; book <= 66; book++) {
  const r = await rpc("event_probe", ["bible-chapter", `${book}:1`]);
  if (r.present) hits++;
}
check(hits === 1, "sweeping every book's chapter 1 finds exactly one hiding place, not zero");

await rpc("event_claim", ["bible-chapter", ROTATION[0]]);
check((await rpc("event_state")).current_level === 3, "claiming [MUSICA] advances to level 3");

// A helper for everyone after Alice: join, preview, and get past [SAGIP].
async function newPlayerOnLevel2(email) {
  const id = await makeAccount(email);
  await signIn(id);
  await rpc("event_join");
  await rpc("event_start_preview");
  await rpc("event_claim", ["song-editor", JESUS_SAVES]);
  return id;
}

// The forwarded answer. Bob arrives after Alice solved it, so Jude is stale.
const bob = await newPlayerOnLevel2("bob@example.test");
check(
  (await rpc("event_probe", ["bible-chapter", ROTATION[0]])).present === false,
  "the answer somebody passed on (Jude) is empty for the next player",
);
const bobStale = await rpc("event_claim", ["bible-chapter", ROTATION[0]]);
check(bobStale.ok === false, "and claiming it outright does not work either");
check(
  (await rpc("event_probe", ["bible-chapter", ROTATION[1]])).present === true,
  `it has moved on to ${ROTATION[1]} (Psalm 51)`,
);
await rpc("event_claim", ["bible-chapter", ROTATION[1]]);

// Four stops, then round again. One fresh player per stop, because a player
// who has already found [MUSICA] is on level 3 and the Bible hides nothing
// from them any more.
const carol = await newPlayerOnLevel2("carol@example.test");
check(
  (await rpc("event_probe", ["bible-chapter", ROTATION[2]])).present === true,
  `the third solver is sent to ${ROTATION[2]} (Matthew 1)`,
);
await rpc("event_claim", ["bible-chapter", ROTATION[2]]);

const dave = await newPlayerOnLevel2("dave@example.test");
check(
  (await rpc("event_probe", ["bible-chapter", ROTATION[3]])).present === true,
  `the fourth is sent to ${ROTATION[3]} (Revelation 1)`,
);
await rpc("event_claim", ["bible-chapter", ROTATION[3]]);

const erin = await newPlayerOnLevel2("erin@example.test");
check(
  (await rpc("event_probe", ["bible-chapter", ROTATION[0]])).present === true,
  "the fifth comes back round to Jude",
);
await rpc("event_claim", ["bible-chapter", ROTATION[0]]);

// The grace window. Frank is shown a target; Heidi then solves and rotates the
// board out from under him. His click should still land -- being beaten to the
// submit by a stranger is not a wrong answer.
const frank = await newPlayerOnLevel2("frank@example.test");
let frankTarget = null;
for (const target of ROTATION) {
  if ((await rpc("event_probe", ["bible-chapter", target])).present) {
    frankTarget = target;
    break;
  }
}
check(frankTarget !== null, "the sixth player is shown a hiding place of their own");

await newPlayerOnLevel2("heidi@example.test");
for (const target of ROTATION) {
  if ((await rpc("event_probe", ["bible-chapter", target])).present) {
    await rpc("event_claim", ["bible-chapter", target]);
    break;
  }
}

await signIn(frank);
const graced = await rpc("event_claim", ["bible-chapter", frankTarget]);
check(
  graced.ok === true,
  "a player who was shown a target still gets it after somebody else rotates the board",
);

// ---------------------------------------------------------------------------
// 5. Level 3, the finish, and the five slots
// ---------------------------------------------------------------------------

console.log("\n[PRO] and the prize");

await signIn(alice);
const proHidden = await rpc("event_probe", ["event-word", "sagipmusica"]);
check(proHidden.present === false, "the wrong word on the card hides nothing");
check(
  (await rpc("event_probe", ["event-word", "pro"])).present === true,
  "the word Pro answers once levels 1 and 2 are done",
);

const finish = await rpc("event_claim", ["event-word", "pro"]);
check(finish.ok === true && finish.completed === true, "claiming [PRO] completes the hunt");
check(finish.winner_rank === 1, "the first finisher takes slot 1");

await db.exec(`reset role`);
const aliceTier = await one(`select subscription from profiles where id = $1`, [alice]);
check(aliceTier.subscription === "pro", "the winner's account is now Pro");

// Fill the remaining four slots, then prove the next finisher is too late.
for (const user of [bob, carol, dave, erin]) {
  await signIn(user);
  await rpc("event_claim", ["event-word", "pro"]);
}

await db.exec(`reset role`);
const taken = await one(
  `select count(*)::int as n from event_participants where winner_rank is not null`,
);
check(taken.n === 5, "five slots are taken and no more");

await signIn(frank);
const sixth = await rpc("event_claim", ["event-word", "pro"]);
check(
  sixth.ok === true && sixth.completed === true && !sixth.winner_rank,
  "the sixth finisher completes the hunt but takes no slot",
);

await db.exec(`reset role`);
const frankTier = await one(`select subscription from profiles where id = $1`, [frank]);
check(frankTier.subscription === "free", "and stays on the free plan");

// ---------------------------------------------------------------------------
// 6. The shortcuts that do not involve playing at all
// ---------------------------------------------------------------------------

console.log("\ncheating");

const grace = await makeAccount("grace@example.test");
await signIn(grace);

check(
  await refused(`select * from event_challenges`),
  "the answer table cannot be read by an authenticated request",
);
await signIn(grace);
check(
  await refused(`select * from event_solves`),
  "neither can the solve log",
);
await signIn(grace);
check(
  await refused(`select * from event_settings`),
  "nor the settings",
);
await signIn(grace);
check(
  await refused(`select event_level2_target()`),
  "and the function that computes the current answer is not executable",
);

await signIn(grace);
check(
  await refused(`update profiles set subscription = 'pro' where id = '${grace}'`),
  "an account cannot write itself a Pro tier",
);

await signIn(grace);
await db.query(`update profiles set name = 'Grace' where id = $1`, [grace]);
await db.exec(`reset role`);
const graceRow = await one(`select name, subscription from profiles where id = $1`, [grace]);
check(
  graceRow.name === "Grace" && graceRow.subscription === "free",
  "but can still edit its own name, which is what that policy is for",
);

// Claiming without joining.
await signIn(grace);
const unjoined = await rpc("event_claim", ["song-editor", JESUS_SAVES]);
check(
  unjoined.ok === false && unjoined.reason === "not_joined",
  "claiming without joining is refused",
);

// The probe budget.
await rpc("event_join");
await rpc("event_start_preview");
let throttled = false;
for (let i = 0; i < 120 && !throttled; i++) {
  const r = await rpc("event_probe", ["bible-chapter", `${(i % 66) + 1}:2`]);
  if (r.throttled) throttled = true;
}
check(throttled, "a scripted sweep runs out of probe budget inside two hundred tries");

// The claim cool-off.
let cooled = false;
for (let i = 0; i < 20 && !cooled; i++) {
  const r = await rpc("event_claim", ["song-editor", `guess ${i}`]);
  if (r.reason === "cooldown") cooled = true;
}
check(cooled, "a run of wrong claims lands the account in a cool-off");

// ---------------------------------------------------------------------------
// 7. Resetting, which the localhost controls rely on
// ---------------------------------------------------------------------------

console.log("\npreview controls");

await signIn(alice);
await rpc("event_reset_me");
const reset = await rpc("event_state");
check(reset.joined === false && !reset.completed, "reset puts an account back to the start");
check(reset.subscription === "free", "and takes the Pro tier back with it");

await db.exec(`reset role`);
const releasedSlots = await one(
  `select count(*)::int as n from event_participants where winner_rank is not null`,
);
check(releasedSlots.n === 4, "the prize slot it was holding is released for a real player");

await db.exec(`update event_settings set preview_enabled = false where id = 1`);
await signIn(alice);
check(
  await refused(`select event_start_preview()`),
  "with preview_enabled off, the localhost Start button's RPC is refused",
);
await signIn(alice);
check(
  await refused(`select event_reset_me()`),
  "and so is reset -- one flag closes both before launch",
);

// And with preview off, the countdown is the only way in.
await signIn(alice);
await rpc("event_join");
check(
  (await rpc("event_state")).hunt_open === false,
  "a fresh account cannot open the hunt before 14 Sep 2026 by any route",
);

// ---------------------------------------------------------------------------
// 8. The start time itself
// ---------------------------------------------------------------------------

console.log("\nstart time");

await db.exec(`reset role`);
const starts = await one(
  `select starts_at,
          to_char(starts_at at time zone 'Asia/Manila', 'YYYY-MM-DD HH24:MI') as manila
   from event_settings where id = 1`,
);
check(
  starts.manila === "2026-09-14 08:00",
  `the hunt opens at 8am Manila time on 14 September 2026 (got ${starts.manila})`,
);

// Wind the clock forward and confirm the gate opens on its own.
await db.exec(`update event_settings set starts_at = now() - interval '1 minute' where id = 1`);
await signIn(alice);
check(
  (await rpc("event_state")).hunt_open === true,
  "once the start time passes, the hunt opens without a preview",
);
check(
  (await rpc("event_probe", ["song-editor", JESUS_SAVES])).present === true,
  "and the words are findable again",
);

// ---------------------------------------------------------------------------
// 9. The closing date
//
// The board vanishing is the visible half of this; the half that matters is
// that the hunt is genuinely shut, for everybody, including the preview
// accounts that were allowed to skip the opening.
// ---------------------------------------------------------------------------

console.log("\nclosing week");

await db.exec(`reset role`);
// Section 8 wound the clock forward to prove the gate opens on its own, so
// read the shipped configuration back rather than whatever it left behind --
// what is being asserted here is the migration's defaults, not this script's
// leftovers.
await db.exec(`update event_settings set starts_at = default, ends_at = default where id = 1`);
const window_ = await one(
  `select to_char(starts_at at time zone 'Asia/Manila', 'YYYY-MM-DD HH24:MI') as opens,
          to_char(ends_at   at time zone 'Asia/Manila', 'YYYY-MM-DD HH24:MI') as closes,
          (extract(epoch from (ends_at - starts_at)) / 86400)::int as span_days
   from event_settings where id = 1`,
);
check(
  window_.closes === "2026-09-21 08:00",
  `the hunt closes at 8am Manila time on 21 September 2026 (got ${window_.closes})`,
);
check(
  window_.span_days === 7,
  `the window is exactly one week (got ${window_.span_days} days)`,
);

// A window that closes before it opens is rejected outright.
check(
  await refused(`update event_settings set ends_at = starts_at - interval '1 day' where id = 1`),
  "a closing date before the opening date is refused by the constraint",
);

// Mid-week: the board is up and the hunt is playable.
await db.exec(
  `update event_settings
     set starts_at = now() - interval '2 days', ends_at = now() + interval '5 days'
   where id = 1`,
);
const ivy = await makeAccount("ivy@example.test");
await signIn(ivy);
const midweek = await rpc("event_state");
check(midweek.visible === true, "mid-week, the board is visible");
check(midweek.has_ended === false, "and the event has not ended");
await rpc("event_join");
check((await rpc("event_state")).hunt_open === true, "and the hunt is open without a preview");
check(
  (await rpc("event_probe", ["song-editor", JESUS_SAVES])).present === true,
  "so the words are findable",
);

// Now the week is up.
await db.exec(`reset role`);
await db.exec(
  `update event_settings
     set starts_at = now() - interval '9 days', ends_at = now() - interval '2 days'
   where id = 1`,
);

await signIn(ivy);
const closed = await rpc("event_state");
check(closed.visible === false, "once the week is up the board is no longer visible");
check(closed.has_ended === true, "and the state says the event has ended");
check(closed.hunt_open === false, "the hunt is shut");
check(
  (await rpc("event_probe", ["song-editor", JESUS_SAVES])).present === false,
  "standing on a hiding place finds nothing after the close",
);
const lateClaim = await rpc("event_claim", ["song-editor", JESUS_SAVES]);
check(
  lateClaim.ok === false && lateClaim.reason === "not_open",
  "and a claim posted after the close is refused",
);

// The close beats a preview, unlike the opening. Preview is switched back on
// first so this is testing the closing date and not the flag section 7 left
// turned off.
await db.exec(`reset role`);
await db.exec(`update event_settings set preview_enabled = true where id = 1`);
await signIn(ivy);
await rpc("event_start_preview");
check(
  (await rpc("event_state")).hunt_open === false,
  "a preview account cannot reopen a finished hunt",
);
check(
  (await rpc("event_probe", ["bible-chapter", ROTATION[0]])).present === false,
  "and still finds nothing",
);

// Nobody new can enrol into a finished event.
const jonah = await makeAccount("jonah@example.test");
await signIn(jonah);
check(await refused(`select event_join()`), "joining a finished event is refused");

// What the winners were promised: the prize outlives the board.
await db.exec(`reset role`);
const survivors = await one(
  `select
     (select count(*)::int from profiles where subscription = 'pro') as pro,
     (select count(*)::int from event_solves) as solves,
     (select count(*)::int from event_participants where winner_rank is not null) as ranked`,
);
check(
  survivors.pro > 0 && survivors.ranked > 0 && survivors.solves > 0,
  `the board is gone but the record is not: ${survivors.pro} Pro accounts, ` +
    `${survivors.ranked} ranked winners, ${survivors.solves} solves still on file`,
);

// ---------------------------------------------------------------------------
// 10. The grand entrance
//
// Shown once per ACCOUNT, and only while there is still an event to be
// announced. The sequencing against the onboarding tour is a client concern
// (see EventIntroduction); what has to hold here is that the server remembers.
// ---------------------------------------------------------------------------

console.log("\nannouncement");

// Put the window back so there is something to announce.
await db.exec(`reset role`);
await db.exec(`update event_settings set starts_at = default, ends_at = default where id = 1`);

const kim = await makeAccount("kim@example.test");
await signIn(kim);
check(
  (await rpc("event_state")).announcement_seen === false,
  "an account that has never been told has not seen the announcement",
);

await rpc("event_ack_announcement");
check(
  (await rpc("event_state")).announcement_seen === true,
  "acknowledging it sticks",
);

await rpc("event_ack_announcement");
await db.exec(`reset role`);
const acks = await one(
  `select count(*)::int as n from event_announcement_seen where user_id = $1`,
  [kim],
);
check(acks.n === 1, "acknowledging twice is a double click, not a second row");

// It is per account, not per browser or per session.
await signIn(alice);
check(
  (await rpc("event_state")).announcement_seen === false,
  "another account has not been told just because this one was",
);

// The localhost Reset button has to clear it, or the entrance is testable once.
await db.exec(`reset role`);
await db.exec(`update event_settings set preview_enabled = true where id = 1`);
await signIn(kim);
await rpc("event_reset_me");
check(
  (await rpc("event_state")).announcement_seen === false,
  "reset clears it so the entrance can be walked again on localhost",
);

// ---------------------------------------------------------------------------
// 11. What a signed-out visitor may read
//
// The landing page section asks event_state() with no session at all. It needs
// enough to decide whether to render, and nothing that belongs to an account.
// ---------------------------------------------------------------------------

console.log("\nlanding page (anon)");

await db.exec(`reset role`);
await db.query(`select set_config('request.jwt.claim.sub', '', false)`);
await db.exec(`set role anon`);

const anon = await rpc("event_state");
check(anon.visible === true, "anon can see whether the event is on");
check(
  typeof anon.starts_at === "string" && typeof anon.ends_at === "string",
  "and when it runs, which is what the section prints",
);
check(anon.joined === false, "anon is never joined");
check(
  anon.announcement_seen === true,
  "and is never offered the entrance -- there is no account to remember it against",
);
check(
  anon.challenges === undefined &&
    anon.solved_levels === undefined &&
    anon.subscription === undefined,
  "the signed-out payload carries no riddles, no progress and no tier",
);

// Everything else in the feature stays shut to anon.
check(await refused(`select event_probe('song-editor', $1)`, [JESUS_SAVES]),
  "anon cannot probe");
await db.exec(`set role anon`);
check(await refused(`select event_claim('song-editor', $1)`, [JESUS_SAVES]),
  "anon cannot claim");
await db.exec(`set role anon`);
check(await refused(`select event_join()`), "anon cannot join");
await db.exec(`set role anon`);
check(await refused(`select event_ack_announcement()`), "anon cannot acknowledge");
await db.exec(`set role anon`);
check(await refused(`select * from event_announcement_seen`),
  "and cannot read who has been told");

// Once the event closes the section takes itself off the landing page.
await db.exec(`reset role`);
await db.exec(
  `update event_settings
     set starts_at = now() - interval '8 days', ends_at = now() - interval '1 minute'
   where id = 1`,
);
await db.exec(`set role anon`);
check(
  (await rpc("event_state")).visible === false,
  "after the close, anon is told there is nothing to advertise",
);

// ---------------------------------------------------------------------------
// 11b. Turning preview off revokes the previews already handed out
//
// 0027 stopped new previews being issued. On its own that left every account
// used in testing still inside the hunt -- able to play, and to take all five
// permanent Pro slots, weeks before anybody else could reach it. 0028 makes
// the flag an actual off switch.
// ---------------------------------------------------------------------------

console.log("\npreview revocation");

await db.exec(`reset role`);
await db.exec(
  `update event_settings
      set starts_at = default, ends_at = default, preview_enabled = true
    where id = 1`,
);

const nia = await makeAccount("nia@example.test");
await signIn(nia);
await rpc("event_join");
await rpc("event_start_preview");
check(
  (await rpc("event_state")).hunt_open === true,
  "an account holding a preview is inside the hunt while previews are on",
);

await db.exec(`reset role`);
await db.exec(`update event_settings set preview_enabled = false where id = 1`);

await signIn(nia);
const revoked = await rpc("event_state");
check(
  revoked.hunt_open === false,
  "switching previews off puts it straight back out again -- no restart needed",
);
check(
  (await rpc("event_probe", ["song-editor", JESUS_SAVES])).present === false,
  "and it can no longer find anything",
);
const lockedOut = await rpc("event_claim", ["song-editor", JESUS_SAVES]);
check(
  lockedOut.ok === false && lockedOut.reason === "not_open",
  "nor claim anything",
);

// And the countdown the board draws from: shut means "Starts in", which is
// what the 22-day reading was really about.
check(
  revoked.has_started === false && revoked.visible === true,
  "the board is up and counting down to the START, not the close",
);

await db.exec(`reset role`);
await db.exec(`update event_settings set preview_enabled = true where id = 1`);

// ---------------------------------------------------------------------------
// 12. Applied in the wrong order
//
// Each of 0023-0025 redefines the whole of event_state(), because each adds a
// field to it. Pasted into the SQL editor by hand that is easy to get wrong,
// and the failure is vicious: run 0023 last and the function goes back to the
// version with no `visible` in it. Every table, every row and every grant is
// still perfect, and the event vanishes from the app.
//
// This reproduces that on a second database, then proves 0026 puts it right.
// ---------------------------------------------------------------------------

console.log("\nout-of-order recovery");

const scratch = await PGlite.create();
await scratch.exec(STUB);
const sql = (name) =>
  readFileSync(resolve(ROOT, "supabase/migrations", name), "utf8");

for (const migration of [
  "0023_text_hunt_event.sql",
  "0024_text_hunt_end_date.sql",
  "0025_text_hunt_announcement.sql",
  // ...and then 0023 again, which is what "I put 0023 0024 0025 again" does if
  // the editor runs them top to bottom from a file that starts at 0023.
  "0023_text_hunt_event.sql",
]) {
  await scratch.exec(sql(migration));
}

const broken = (await scratch.query(`select event_state() as r`)).rows[0].r;
check(
  broken.visible === undefined,
  "re-running 0023 last drops `visible` from event_state() -- the event disappears",
);
check(
  broken.active === true,
  "...while the event itself is still perfectly on, which is what makes it hard to spot",
);

await scratch.exec(sql("0026_text_hunt_repair.sql"));

const repaired = (await scratch.query(`select event_state() as r`)).rows[0].r;
check(repaired.visible === true, "0026 restores `visible`");
check(
  typeof repaired.ends_at === "string" && repaired.has_ended === false,
  "and the rest of the closing-date fields with it",
);
check(
  (
    await scratch.query(
      `select has_function_privilege('anon', 'event_state()', 'execute') as ok`,
    )
  ).rows[0].ok === true,
  "and the anon grant the landing page needs",
);

// Running the repair twice must be as safe as running it once, since that is
// the whole promise the file makes at the top of itself.
await scratch.exec(sql("0026_text_hunt_repair.sql"));
check(
  (await scratch.query(`select event_state() as r`)).rows[0].r.visible === true,
  "and it is safe to run again",
);

await scratch.close();

await db.exec(`reset role`);
await db.close();

console.log(failures === 0 ? "\nall checks passed" : `\n${failures} FAILURES`);
process.exit(failures === 0 ? 0 : 1);
