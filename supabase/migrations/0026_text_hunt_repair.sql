-- The 3-Text Hunt, re-asserted in one file. Run this and the event works.
--
-- 0023, 0024 and 0025 each redefine event_state(), because each of them adds a
-- field to it. That is fine applied in order by a migration runner and a trap
-- for anybody pasting them into the SQL editor by hand: run 0023 last and
-- event_state() goes back to the version with no `visible` in it, the
-- dashboard reads `visible` as undefined, and the event silently disappears
-- from the app while every table and every row is still perfectly in place.
--
-- So this file is the whole feature's *final* shape, idempotent and
-- order-independent. It supersedes the function definitions in all three. If
-- the event is ever missing and you are not sure what is deployed, run this;
-- it can be run any number of times.
--
-- It ends with a diagnostic SELECT. Read it -- it answers "is the event on,
-- and why not" without guessing.
--
-- ============================================================================
-- IF THE EVENT STILL DOES NOT APPEAR AFTER RUNNING THIS
--
-- The most likely remaining cause is not SQL at all: PostgREST keeps a cached
-- picture of the schema, and a function it has not noticed yet returns 404 to
-- the browser exactly as if it did not exist. The last statement here tells it
-- to reload. If you have run the migrations and the app still shows nothing,
-- that reload -- not another CREATE -- is usually the missing step.
-- ============================================================================


-- ============================================================================
-- 1. Schema, re-asserted
--
-- All of these are no-ops on a database that already has 0023-0025. They are
-- here so that this file alone is sufficient on one that does not.
-- ============================================================================

alter table event_settings
  add column if not exists ends_at timestamptz not null
    default '2026-09-21 00:00:00+08';

alter table event_settings drop constraint if exists event_settings_window_ordered;
alter table event_settings add constraint event_settings_window_ordered
  check (ends_at > starts_at);

create table if not exists event_announcement_seen (
  user_id uuid primary key references auth.users (id) on delete cascade,
  seen_at timestamptz not null default now()
);

alter table event_announcement_seen enable row level security;
revoke all on table event_announcement_seen from anon, authenticated;

-- There must be exactly one settings row, and it must have a window. A missing
-- row is the other way the event goes quiet: event_state() reads `select *
-- into v_settings ... where id = 1`, finds nothing, and reports the event off.
insert into event_settings (id) values (1) on conflict (id) do nothing;


-- ============================================================================
-- 2. The gate
-- ============================================================================

create or replace function event_hunt_open(p_user uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select
    coalesce((select is_active from event_settings where id = 1), false)
    -- The close, which no account gets past -- preview included.
    and now() < (select ends_at from event_settings where id = 1)
    and (
      -- The open, which a preview account may skip.
      now() >= (select starts_at from event_settings where id = 1)
      or exists (
        select 1 from event_participants
        where user_id = p_user and preview_started_at is not null
      )
    );
$$;


-- ============================================================================
-- 3. State -- the definitive version
--
-- Every field the client reads, in one place. If a field is ever added here,
-- add it HERE and nowhere else.
-- ============================================================================

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
  v_ended boolean;
begin
  select * into v_settings from event_settings where id = 1;

  if v_settings is null or not v_settings.is_active then
    return jsonb_build_object('active', false, 'visible', false, 'server_now', now());
  end if;

  v_ended := now() >= v_settings.ends_at;

  if v_user is null then
    return jsonb_build_object(
      'active', true,
      'visible', not v_ended,
      'server_now', now(),
      'starts_at', v_settings.starts_at,
      'ends_at', v_settings.ends_at,
      'has_started', now() >= v_settings.starts_at,
      'has_ended', v_ended,
      'joined', false,
      'announcement_seen', true,
      'participants', (select count(*) from event_participants)
    );
  end if;

  select * into v_participant from event_participants where user_id = v_user;

  v_current := event_current_level(v_user);
  select coalesce(array_agg(level order by level), '{}')
    into v_solved from event_solves where user_id = v_user;

  return jsonb_build_object(
    'active', true,
    'visible', not v_ended,

    'server_now', now(),
    'starts_at', v_settings.starts_at,
    'ends_at', v_settings.ends_at,
    'has_started', now() >= v_settings.starts_at,
    'has_ended', v_ended,

    'announcement_seen', exists (
      select 1 from event_announcement_seen where user_id = v_user
    ),

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
          'prompt', case when c.level = any(v_solved) or c.level = v_current then c.prompt end,
          'hint', case when c.level = any(v_solved) or c.level = v_current then c.hint end
        ) order by c.level
      ), '[]'::jsonb)
      from event_challenges c
    )
  );
end;
$$;


-- ============================================================================
-- 4. The rest of the API, re-asserted at its final shape
-- ============================================================================

create or replace function event_join()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_settings event_settings;
begin
  if v_user is null then
    raise exception 'Not signed in';
  end if;

  select * into v_settings from event_settings where id = 1;

  if v_settings is null or not v_settings.is_active then
    raise exception 'The event is not running';
  end if;

  if now() >= v_settings.ends_at then
    raise exception 'The event has ended';
  end if;

  insert into event_participants (user_id)
  values (v_user)
  on conflict (user_id) do nothing;

  return event_state();
end;
$$;

create or replace function event_ack_announcement()
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

  insert into event_announcement_seen (user_id)
  values (v_user)
  on conflict (user_id) do nothing;

  return event_state();
end;
$$;

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
  delete from event_announcement_seen where user_id = v_user;

  update profiles
    set subscription = 'free', subscription_granted_at = null
    where id = v_user;

  return event_state();
end;
$$;


-- ============================================================================
-- 5. Grants, re-asserted
--
-- A function recreated by an out-of-order run comes back with default
-- privileges, which is the other way the event goes quiet: the row is there,
-- the function is there, and the browser gets "permission denied".
-- ============================================================================

revoke all on function event_state() from public, anon;
revoke all on function event_join() from public, anon;
revoke all on function event_ack_announcement() from public, anon;
revoke all on function event_start_preview() from public, anon;
revoke all on function event_reset_me() from public, anon;
revoke all on function event_probe(text, text) from public, anon;
revoke all on function event_claim(text, text) from public, anon;
revoke all on function event_level2_target() from public, anon;
revoke all on function event_hunt_open(uuid) from public, anon;
revoke all on function event_current_level(uuid) from public, anon;

-- anon reads state and nothing else: the landing page has to know whether the
-- event is on. See 0025 for why that payload is safe.
grant execute on function event_state() to anon, authenticated;

grant execute on function event_join() to authenticated;
grant execute on function event_ack_announcement() to authenticated;
grant execute on function event_start_preview() to authenticated;
grant execute on function event_reset_me() to authenticated;
grant execute on function event_probe(text, text) to authenticated;
grant execute on function event_claim(text, text) to authenticated;


-- ============================================================================
-- 6. Tell PostgREST to look again
--
-- Without this the API can keep serving a cached schema in which these
-- functions do not exist, and every call 404s exactly as if the migration had
-- never run. Supabase usually reloads on its own; this makes it certain.
-- ============================================================================

notify pgrst, 'reload schema';


-- ============================================================================
-- 7. Diagnostic -- read this output
--
--   event_is_on          must be true, or the board is hidden by design
--   window_open_now      false before 14 Sep and after 21 Sep; preview covers it
--   state_has_visible    must be true; false means an old event_state() won
--   anon_can_read_state  must be true, or the landing page section stays blank
--   auth_can_read_state  must be true, or the dashboard shows nothing
-- ============================================================================

select
  s.is_active                                          as event_is_on,
  s.starts_at,
  s.ends_at,
  now() >= s.starts_at and now() < s.ends_at           as window_open_now,
  s.preview_enabled,
  s.winner_slots,
  (select count(*) from event_challenges)              as challenges_loaded,
  (select count(*) from event_participants)            as participants,
  event_state() ? 'visible'                            as state_has_visible,
  has_function_privilege('anon', 'event_state()', 'execute')          as anon_can_read_state,
  has_function_privilege('authenticated', 'event_state()', 'execute') as auth_can_read_state
from event_settings s
where s.id = 1;
