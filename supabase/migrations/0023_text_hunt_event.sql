-- The SagipMusica 3-Text Hunt Challenge.
--
-- A scavenger hunt that runs inside the app: three code words -- [SAGIP],
-- [MUSICA] and [PRO] -- are hidden on three different screens, and the first
-- five accounts to find all three in order keep SagipMusica Pro permanently.
--
-- ============================================================================
-- WHY THIS IS ALMOST ENTIRELY SERVER-SIDE
--
-- A treasure hunt in a single-page app has an obvious failure mode: the
-- answers ship inside the JavaScript bundle. Open devtools, search it for
-- "Jude" or "Jesus Saves", win the prize without playing. Anything worth five
-- Pro accounts is worth somebody doing exactly that.
--
-- So the client is never told where anything is hidden. It works the other way
-- round: as the user moves through the app, each participating screen *asks*
--
--     event_probe('bible-chapter', '65:1')   -- "am I standing on anything?"
--
-- and the server answers yes or no. The answer keys live in event_challenges,
-- which has no SELECT grant to anybody -- not anon, not authenticated. There
-- is no request a browser can make that returns them. The bundle contains
-- three slot names and nothing else; a cheater reading it learns that
-- something can be hidden on the song editor, in a Bible chapter, and on the
-- event card, which is roughly what the riddles say out loud anyway.
--
-- Everything else that could be cheated is checked here too:
--
--  * The countdown. The client is handed the server's clock alongside the
--    start time and ticks from the difference, so moving the machine's clock
--    or editing the DOM changes a number on a screen and nothing else. probe
--    and claim both refuse before the start, which is where it counts.
--
--  * The order. A claim for level N is refused unless levels 1..N-1 are
--    already in event_solves for that account. There is no skipping to [PRO].
--
--  * The prize. The five slots are handed out under a row lock on the settings
--    row, so two accounts finishing in the same instant cannot take the same
--    rank, and profiles.subscription is written here rather than by the client
--    -- see lock_profile_subscription() below for what stops a one-line PATCH.
--
--  * Brute force. Slot names are guessable in principle, so probes are
--    budgeted per minute per account and failed claims are counted.
--
-- ============================================================================
-- THE THREE HIDING PLACES
--
--   1. [SAGIP]   The song editor, on a song titled "Jesus Saves" -- so the
--                player has to find it in the shared library, add it to their
--                hymnal, and open it for editing. Matched on the title, not on
--                a song id, because every church's copy is a different row.
--
--   2. [MUSICA]  The end of a Bible chapter -- Jude, to begin with. This one
--                MOVES: the target rotates every time somebody solves it, so
--                an answer passed around a group chat is stale by the time the
--                second person tries it. See event_level2_target().
--
--   3. [PRO]     The word "Pro" in the event card's own headline, which has
--                been sitting on the dashboard since the announcement. It is
--                inert text -- no pointer, no hover -- until an account has
--                solved 1 and 2, and then it is the answer. Its riddle is
--                deliberately useless ("songs? bible? landing page?"): the
--                intended solve is realising that the thing you have been
--                staring at all along was the thing.
-- ============================================================================


-- ============================================================================
-- 1. Subscription tier
--
-- Every account has one, starting free, so "what does a Pro account see" is a
-- question the UI can ask today rather than one that appears with Pro. The
-- prize writes 'pro' here.
-- ============================================================================

alter table profiles
  add column if not exists subscription text not null default 'free'
    check (subscription in ('free', 'pro'));

alter table profiles
  add column if not exists subscription_granted_at timestamptz;

comment on column profiles.subscription is
  'Plan tier. Written only by event_claim() and by SQL; see 0023.';

-- The column is not self-writable.
--
-- profiles_update_self (0004) lets an account update its own row so it can
-- change its name, and that is one PATCH away from granting yourself Pro now
-- that this column exists. Same shape as lock_profile_church() in 0010: the
-- guard is a trigger rather than a narrower policy, because a policy that has
-- to compare against the row's own previous value ends up reading the row it
-- is gating.
--
-- current_user is the test. PostgREST runs a browser's request as the
-- `authenticated` role; a SECURITY DEFINER function runs as its owner. So
-- event_claim() below writes the column freely and a request from the client
-- cannot, without either side having to pass a flag the other could forge.
create or replace function lock_profile_subscription()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.subscription is distinct from old.subscription
     and current_user in ('authenticated', 'anon') then
    raise exception 'subscription cannot be changed from the client';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_lock_profile_subscription on profiles;
create trigger trg_lock_profile_subscription
  before update on profiles
  for each row execute function lock_profile_subscription();


-- ============================================================================
-- 2. Tables
-- ============================================================================

-- One row, ever. Holds the dials so the start time and the prize count can
-- change without a deploy, and so the winner draw has something to lock.
create table if not exists event_settings (
  id int primary key default 1 check (id = 1),

  -- Kill switch. False hides the whole thing from the dashboard.
  is_active boolean not null default true,

  -- 14 September 2026, midnight Philippine time. Written with its offset so it
  -- is unambiguous; Postgres stores the instant either way.
  starts_at timestamptz not null default '2026-09-14 00:00:00+08',

  -- How many accounts keep Pro.
  winner_slots int not null default 5 check (winner_slots >= 0),

  -- ------------------------------------------------------------------------
  -- LOCALHOST TESTING -- read this before the event goes live.
  --
  -- True lets an account call event_start_preview() and play the whole hunt
  -- immediately, ignoring starts_at, and event_reset_me() to wipe its own
  -- progress and go again. The buttons for both render only in a Vite dev
  -- build, but that is a convenience and not the control -- the control is
  -- this flag, because the client is not trusted with anything.
  --
  -- It ships true so the hunt can be walked end to end on localhost as soon as
  -- this migration is applied. BEFORE THE REAL EVENT:
  --
  --     update event_settings set preview_enabled = false where id = 1;
  --
  -- Leaving it on in production means anyone who finds the RPC can start early
  -- and take a prize slot.
  -- ------------------------------------------------------------------------
  preview_enabled boolean not null default true,

  updated_at timestamptz not null default now()
);

insert into event_settings (id) values (1) on conflict (id) do nothing;

-- The answer key. No role has SELECT on this table -- see section 5.
create table if not exists event_challenges (
  level int primary key check (level between 1 and 3),

  -- What is being hunted, e.g. 'SAGIP'. Not a secret; the card headline spells
  -- all three out on purpose.
  code_word text not null,

  -- The riddle and its nudge, released once the level is the current one.
  prompt text not null,
  hint text not null,

  -- Which screen asks about this level. The client passes the slot it is
  -- standing on; these three strings are the only ones that mean anything.
  slot text not null,

  -- What that screen must pass as context for the answer to be here. Null when
  -- the target is computed instead -- level 2 rotates, see below.
  answer_key text,

  -- Level 2's carousel of hiding places, as 'book_id:chapter'. Jude, then
  -- Psalm 51, then Matthew 1, then Revelation 1, then round again.
  answer_rotation text[]
);

insert into event_challenges (level, code_word, prompt, hint, slot, answer_key, answer_rotation)
values
  (1, 'SAGIP',
   'Find me: [SAGIP] — I''m in the songs library, or in your saved songs!',
   'Click edit, and I am at the end.',
   'song-editor', 'jesus saves', null),

  (2, 'MUSICA',
   'Find me: [MUSICA] — I''m somewhere in the Bible.',
   'At the end of a chapter.',
   'bible-chapter', null, array['65:1', '19:51', '40:1', '66:1']),

  (3, 'PRO',
   'Find me: [PRO] — I''m somewhere in the songs? the bible? the landing page? presentations? or here? I don''t know...',
   '....',
   'event-word', 'pro', null)
on conflict (level) do update set
  code_word = excluded.code_word,
  prompt = excluded.prompt,
  hint = excluded.hint,
  slot = excluded.slot,
  answer_key = excluded.answer_key,
  answer_rotation = excluded.answer_rotation;

-- Who is playing. One row per account, created by event_join().
create table if not exists event_participants (
  user_id uuid primary key references auth.users (id) on delete cascade,
  joined_at timestamptz not null default now(),

  -- Set by event_start_preview(). Non-null means this account is playing ahead
  -- of starts_at, which is only reachable while preview_enabled is on.
  preview_started_at timestamptz,

  -- Stamped when level 3 goes in.
  completed_at timestamptz,

  -- 1..winner_slots for the accounts that finished in time; null for everyone
  -- else, later finishers included. The hunt stays completable after the
  -- prizes run out, it just stops paying out.
  winner_rank int,

  -- Level 2 moves while you are looking at it. The probe that revealed the
  -- word to this account records which target it was shown, so a click landing
  -- a moment after somebody else rotated the board still counts. Without this,
  -- finding it and being beaten to the click by a stranger is a loss.
  probe_target text,
  probe_target_at timestamptz,

  -- Per-minute probe budget. A probe is how you ask "is it here?", so an
  -- unbudgeted one is an oracle you could walk the whole Bible through in a
  -- few seconds. Ordinary play spends one per screen opened.
  probe_window_at timestamptz,
  probe_count int not null default 0,

  -- Failed claims, kept for the same reason, and because a spike in them is
  -- what a scripted attempt looks like.
  failed_claims int not null default 0,
  last_failed_claim_at timestamptz
);

create table if not exists event_solves (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  level int not null references event_challenges (level),
  solved_at timestamptz not null default now(),
  unique (user_id, level)
);

-- Level 2's rotation counts these by level; the state call counts them by user.
create index if not exists idx_event_solves_level on event_solves (level);
create index if not exists idx_event_solves_user on event_solves (user_id);


-- ============================================================================
-- 3. Rules
-- ============================================================================

-- The rotating target for [MUSICA].
--
-- The index is how many accounts have already solved level 2, so the word
-- leaves Jude the moment the first person finds it there and an answer
-- forwarded to a friend points at an empty chapter. Four stops, then it comes
-- round again -- the earliest players' answers become true a second time,
-- which is a nicer end than running out of hiding places.
create or replace function event_level2_target()
returns text
language sql
security definer
stable
set search_path = public
as $$
  select rotation[(solved % array_length(rotation, 1)) + 1]
  from (
    select
      (select answer_rotation from event_challenges where level = 2) as rotation,
      (select count(*) from event_solves where level = 2) as solved
  ) s;
$$;

-- Whether this account may play right now: the clock has reached the start, or
-- it is previewing on localhost. Called by probe and claim, which is the only
-- place the answer matters.
create or replace function event_hunt_open(p_user uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select
    coalesce((select is_active from event_settings where id = 1), false)
    and (
      now() >= (select starts_at from event_settings where id = 1)
      or exists (
        select 1 from event_participants
        where user_id = p_user and preview_started_at is not null
      )
    );
$$;

-- The level this account is on: the lowest one it has not solved, or null once
-- all three are done.
create or replace function event_current_level(p_user uuid)
returns int
language sql
security definer
stable
set search_path = public
as $$
  select min(c.level)
  from event_challenges c
  where not exists (
    select 1 from event_solves s where s.user_id = p_user and s.level = c.level
  );
$$;


-- ============================================================================
-- 4. The API
--
-- Six functions, and between them everything the client is allowed to know.
-- ============================================================================

-- Everything the event UI renders, in one round trip.
--
-- server_now is the point of the whole thing: it is what the countdown counts
-- down from, so the clock on the screen is the database's and not the
-- browser's.
--
-- Note what is not in here: no slot names, no answer keys, and no prompt or
-- hint for a level the account has not reached. A locked level comes back as a
-- code word and the word "locked", which is all the card shows.
create or replace function event_state()
returns jsonb
language plpgsql
security definer
stable
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_settings event_settings;
  v_participant event_participants;
  v_current int;
  v_solved int[];
begin
  select * into v_settings from event_settings where id = 1;

  if v_settings is null or not v_settings.is_active then
    return jsonb_build_object('active', false, 'server_now', now());
  end if;

  if v_user is null then
    return jsonb_build_object(
      'active', true,
      'server_now', now(),
      'starts_at', v_settings.starts_at,
      'has_started', now() >= v_settings.starts_at,
      'joined', false,
      'participants', (select count(*) from event_participants)
    );
  end if;

  select * into v_participant from event_participants where user_id = v_user;

  v_current := event_current_level(v_user);
  select coalesce(array_agg(level order by level), '{}')
    into v_solved from event_solves where user_id = v_user;

  return jsonb_build_object(
    'active', true,
    'server_now', now(),
    'starts_at', v_settings.starts_at,
    'has_started', now() >= v_settings.starts_at,

    -- The dev-only Start button asks about these two. preview_available is the
    -- server's answer to "may anyone preview at all" -- the flag that has to
    -- be off before launch.
    'preview_available', v_settings.preview_enabled,
    'preview', v_participant.preview_started_at is not null,

    'hunt_open', event_hunt_open(v_user),

    'joined', v_participant.user_id is not null,
    'participants', (select count(*) from event_participants),

    'solved_levels', to_jsonb(v_solved),
    'current_level', v_current,
    'completed', v_participant.completed_at is not null,
    'winner_rank', v_participant.winner_rank,
    'winner_slots', v_settings.winner_slots,
    'winners_taken', (select count(*) from event_participants where winner_rank is not null),

    'subscription', (select subscription from profiles where id = v_user),

    'challenges', (
      select coalesce(jsonb_agg(
        jsonb_build_object(
          'level', c.level,
          'code_word', c.code_word,
          'status', case
            when c.level = any(v_solved) then 'solved'
            when v_current is not null and c.level = v_current then 'open'
            else 'locked'
          end,
          -- Withheld until the level is reachable. Handing over all three
          -- riddles at once would let somebody work on 3 while stuck on 1.
          'prompt', case when c.level = any(v_solved) or c.level = v_current then c.prompt end,
          'hint', case when c.level = any(v_solved) or c.level = v_current then c.hint end
        ) order by c.level
      ), '[]'::jsonb)
      from event_challenges c
    )
  );
end;
$$;

-- Enter the hunt. Idempotent -- pressing Join twice is not an error, it is a
-- double click.
create or replace function event_join()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
begin
  if v_user is null then
    raise exception 'Not signed in';
  end if;

  if not coalesce((select is_active from event_settings where id = 1), false) then
    raise exception 'The event is not running';
  end if;

  insert into event_participants (user_id)
  values (v_user)
  on conflict (user_id) do nothing;

  return event_state();
end;
$$;

-- Localhost testing: play now, ignoring the countdown.
--
-- Gated on preview_enabled rather than on anything the client says, because
-- "am I on localhost" is not a question a database can answer, and not a claim
-- a browser gets to make.
create or replace function event_start_preview()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
begin
  if v_user is null then
    raise exception 'Not signed in';
  end if;

  if not coalesce((select preview_enabled from event_settings where id = 1), false) then
    raise exception 'Preview mode is off';
  end if;

  insert into event_participants (user_id, preview_started_at)
  values (v_user, now())
  on conflict (user_id) do update set preview_started_at = now();

  return event_state();
end;
$$;

-- Localhost testing: forget everything this account did and put it back on the
-- free tier, so the hunt can be walked again from the top.
--
-- Only ever touches the calling account. The winner rank is released too --
-- otherwise a few test runs would quietly eat all five prize slots before the
-- event opened.
create or replace function event_reset_me()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
begin
  if v_user is null then
    raise exception 'Not signed in';
  end if;

  if not coalesce((select preview_enabled from event_settings where id = 1), false) then
    raise exception 'Preview mode is off';
  end if;

  delete from event_solves where user_id = v_user;
  delete from event_participants where user_id = v_user;

  update profiles
    set subscription = 'free', subscription_granted_at = null
    where id = v_user;

  return event_state();
end;
$$;

-- "Is anything hidden on this screen?"
--
-- The client calls this with where it is standing, never with a guess at where
-- the word is, because it has no idea. A yes comes back with the code word to
-- render and nothing else -- no target, no answer key, nothing that would help
-- on the next level.
--
-- p_slot is one of 'song-editor', 'bible-chapter', 'event-word'. p_context is
-- what that screen makes of itself: the song title, the 'book:chapter' it is
-- showing, or the word being asked about.
create or replace function event_probe(p_slot text, p_context text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_participant event_participants;
  v_level int;
  v_challenge event_challenges;
  v_expected text;
  v_context text := lower(btrim(coalesce(p_context, '')));
begin
  if v_user is null then
    return jsonb_build_object('present', false);
  end if;

  select * into v_participant from event_participants where user_id = v_user for update;

  -- Not playing, or not playing yet. Both answer the same way: nothing here.
  -- The client learns nothing it could not work out from the state it holds.
  if v_participant.user_id is null or not event_hunt_open(v_user) then
    return jsonb_build_object('present', false);
  end if;

  -- Probe budget, one rolling minute at a time. Playing normally spends a
  -- probe per screen; walking the Bible with a script spends thousands, and
  -- stops here.
  if v_participant.probe_window_at is null
     or v_participant.probe_window_at < now() - interval '1 minute' then
    update event_participants
      set probe_window_at = now(), probe_count = 1
      where user_id = v_user;
  elsif v_participant.probe_count >= 90 then
    return jsonb_build_object('present', false, 'throttled', true);
  else
    update event_participants
      set probe_count = probe_count + 1
      where user_id = v_user;
  end if;

  v_level := event_current_level(v_user);
  if v_level is null then
    return jsonb_build_object('present', false);
  end if;

  select * into v_challenge from event_challenges where level = v_level;
  if v_challenge.slot is distinct from p_slot then
    return jsonb_build_object('present', false);
  end if;

  v_expected := coalesce(v_challenge.answer_key, event_level2_target());

  if v_context is distinct from v_expected then
    return jsonb_build_object('present', false);
  end if;

  -- Found. Remember which target was shown, so the claim can honour it even if
  -- the board rotates in the seconds between seeing it and clicking it.
  update event_participants
    set probe_target = v_expected, probe_target_at = now()
    where user_id = v_user;

  return jsonb_build_object(
    'present', true,
    'level', v_level,
    'code_word', v_challenge.code_word
  );
end;
$$;

-- "I found it, here."
--
-- Re-checks everything rather than trusting that a probe happened: the event
-- is open, the account has joined, the levels below this one are done, and the
-- context really is the answer. A claim posted straight from a console with no
-- probe in front of it is judged on the same terms as one from a click, which
-- is the point -- the check is the puzzle.
create or replace function event_claim(p_slot text, p_context text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_participant event_participants;
  v_level int;
  v_challenge event_challenges;
  v_expected text;
  v_context text := lower(btrim(coalesce(p_context, '')));
  v_slots int;
  v_taken int;
  v_rank int;
  v_completed boolean := false;
begin
  if v_user is null then
    raise exception 'Not signed in';
  end if;

  select * into v_participant from event_participants where user_id = v_user for update;

  if v_participant.user_id is null then
    return jsonb_build_object('ok', false, 'reason', 'not_joined');
  end if;

  if not event_hunt_open(v_user) then
    return jsonb_build_object('ok', false, 'reason', 'not_open');
  end if;

  -- A short cool-off after a burst of wrong answers. Generous enough that
  -- nobody playing honestly will ever see it: an honest claim only happens
  -- after the screen has already told them they found something.
  if v_participant.failed_claims >= 12
     and v_participant.last_failed_claim_at > now() - interval '5 minutes' then
    return jsonb_build_object('ok', false, 'reason', 'cooldown');
  end if;

  v_level := event_current_level(v_user);
  if v_level is null then
    return jsonb_build_object('ok', false, 'reason', 'already_complete');
  end if;

  select * into v_challenge from event_challenges where level = v_level;

  v_expected := coalesce(v_challenge.answer_key, event_level2_target());

  -- The grace window described on probe_target: the target this account was
  -- shown still counts for a few minutes, even once the rotation has moved on.
  if v_challenge.slot is not distinct from p_slot
     and v_challenge.answer_key is null
     and v_participant.probe_target is not null
     and v_participant.probe_target_at > now() - interval '10 minutes'
     and v_context = v_participant.probe_target then
    v_expected := v_participant.probe_target;
  end if;

  if v_challenge.slot is distinct from p_slot or v_context is distinct from v_expected then
    update event_participants
      set failed_claims = failed_claims + 1, last_failed_claim_at = now()
      where user_id = v_user;
    return jsonb_build_object('ok', false, 'reason', 'wrong');
  end if;

  -- The unique (user_id, level) constraint makes a double click a no-op rather
  -- than a second solve, which matters: level 2's rotation counts these rows.
  insert into event_solves (user_id, level)
  values (v_user, v_level)
  on conflict (user_id, level) do nothing;

  update event_participants
    set failed_claims = 0, probe_target = null, probe_target_at = null
    where user_id = v_user;

  -- All three in? Then this is a finish, and possibly a prize.
  if event_current_level(v_user) is null then
    v_completed := true;

    -- The row lock is what makes the five slots five. Two accounts finishing
    -- in the same millisecond serialise here, so the second one reads the
    -- first one's rank and takes the next.
    select winner_slots into v_slots from event_settings where id = 1 for update;
    select count(*) into v_taken from event_participants where winner_rank is not null;

    if v_taken < v_slots then
      v_rank := v_taken + 1;

      update event_participants
        set completed_at = now(), winner_rank = v_rank
        where user_id = v_user;

      -- The prize. Written here, as the function's owner, because a request
      -- from the client cannot write this column -- see
      -- lock_profile_subscription() in section 1.
      update profiles
        set subscription = 'pro', subscription_granted_at = now()
        where id = v_user;
    else
      update event_participants set completed_at = now() where user_id = v_user;
    end if;
  end if;

  return jsonb_build_object(
    'ok', true,
    'level', v_level,
    'code_word', v_challenge.code_word,
    'completed', v_completed,
    'winner_rank', v_rank,
    'state', event_state()
  );
end;
$$;


-- ============================================================================
-- 5. RLS and grants
--
-- The four event tables are readable and writable by nobody. Every grant below
-- is on a function; there is no table-level path into any of this, which is
-- what lets event_challenges hold the answers in plain text.
-- ============================================================================

alter table event_settings enable row level security;
alter table event_challenges enable row level security;
alter table event_participants enable row level security;
alter table event_solves enable row level security;

revoke all on table event_settings from anon, authenticated;
revoke all on table event_challenges from anon, authenticated;
revoke all on table event_participants from anon, authenticated;
revoke all on table event_solves from anon, authenticated;

-- No policies are created, on purpose. RLS on with zero policies denies
-- everything, and the SECURITY DEFINER functions above run as the owner and
-- are not subject to it. Adding a "read your own solves" policy later would be
-- harmless; adding one to event_challenges would give the game away.

revoke all on function event_state() from public, anon;
revoke all on function event_join() from public, anon;
revoke all on function event_start_preview() from public, anon;
revoke all on function event_reset_me() from public, anon;
revoke all on function event_probe(text, text) from public, anon;
revoke all on function event_claim(text, text) from public, anon;
revoke all on function event_level2_target() from public, anon;
revoke all on function event_hunt_open(uuid) from public, anon;
revoke all on function event_current_level(uuid) from public, anon;

grant execute on function event_state() to authenticated;
grant execute on function event_join() to authenticated;
grant execute on function event_start_preview() to authenticated;
grant execute on function event_reset_me() to authenticated;
grant execute on function event_probe(text, text) to authenticated;
grant execute on function event_claim(text, text) to authenticated;

-- The three helpers stay internal. They are called by the functions above,
-- which run as the owner, so nothing needs EXECUTE on them -- and
-- event_level2_target() in particular would hand out the current answer.


-- ============================================================================
-- 6. Superadmin visibility
--
-- The event is worth watching while it runs, and the tier belongs on the
-- accounts list. The list function gains a column, so it is dropped rather
-- than replaced -- Postgres will not change a function's return type in place.
-- ============================================================================

drop function if exists superadmin_list_accounts();

create function superadmin_list_accounts()
returns table (
  id uuid,
  email text,
  name text,
  role text,
  subscription text,
  church_id uuid,
  church_name text,
  onboarding_completed boolean,
  created_at timestamptz,
  last_sign_in_at timestamptz,
  email_confirmed_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not is_superadmin() then
    raise exception 'Not authorised';
  end if;

  return query
    select
      p.id,
      p.email,
      p.name,
      p.role,
      p.subscription,
      p.church_id,
      c.name as church_name,
      p.onboarding_completed,
      p.created_at,
      u.last_sign_in_at,
      u.email_confirmed_at
    from profiles p
    left join churches c on c.id = p.church_id
    left join auth.users u on u.id = p.id
    order by p.created_at desc;
end;
$$;

revoke all on function superadmin_list_accounts() from public, anon;
grant execute on function superadmin_list_accounts() to authenticated;

create or replace function superadmin_stats()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if not is_superadmin() then
    raise exception 'Not authorised';
  end if;

  return jsonb_build_object(
    'total_accounts', (select count(*) from profiles),
    'total_churches', (select count(*) from churches),
    'total_songs', (select count(*) from songs),
    'total_worship_sets', (select count(*) from worship_sets),
    'total_library_songs', (select count(*) from hymn_templates where status = 'published'),
    'total_desktop_downloads', (select count(*) from download_signups),
    'total_pro_accounts', (select count(*) from profiles where subscription = 'pro'),
    'event_participants', (select count(*) from event_participants),
    'event_completions', (select count(*) from event_participants where completed_at is not null)
  );
end;
$$;
