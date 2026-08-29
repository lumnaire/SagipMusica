-- The 3-Text Hunt gets a closing date, and the board learns to leave.
--
-- 0023 shipped an event with a start and no end: the board would have sat on
-- every dashboard forever, counting nothing, long after the five Pro accounts
-- were gone. This gives it a week -- 14 to 21 September 2026, Philippine time
-- -- and makes the end as load-bearing as the start was.
--
-- Design notes:
--
--  * ends_at is enforced in event_hunt_open(), which is the function probe and
--    claim already ask before they do anything. So the hunt closing is not a
--    thing the UI does; a claim posted from a console at 00:01 on the 22nd is
--    refused by the same check that refuses one posted before the start. The
--    board disappearing is the visible half of a decision made here.
--
--  * The end applies to preview accounts too, unlike the start. Preview exists
--    so the hunt can be walked on localhost before it opens, and letting it
--    also outlive the close would mean the one route into a finished event
--    stayed open. To test the shutdown -- or to re-open the hunt for testing
--    after the date has passed -- move the date:
--
--        update event_settings set ends_at = now() - interval '1 minute' where id = 1;  -- closed
--        update event_settings set ends_at = now() + interval '7 days'   where id = 1;  -- open again
--
--  * Exactly one week, so ends_at is midnight opening the 21st rather than
--    midnight closing it. The 21st is the deadline, not a playing day. If the
--    intent changes to "through the 21st", add a day here -- it is one value,
--    and every countdown and closing notice in the app reads it.
--
--  * Nothing is deleted when the event ends. event_solves and the winner ranks
--    stay exactly as they were, because they are the record of who won what,
--    and profiles.subscription is where the prize actually lives. The board
--    going away costs a player nothing they earned -- the PRO tag beside their
--    name is not drawn from any of this.

-- ============================================================================
-- 1. The closing date
-- ============================================================================

alter table event_settings
  add column if not exists ends_at timestamptz not null
    default '2026-09-21 00:00:00+08';

-- A window that closes before it opens would leave the hunt permanently shut
-- with no obvious reason why.
alter table event_settings
  drop constraint if exists event_settings_window_ordered;
alter table event_settings
  add constraint event_settings_window_ordered check (ends_at > starts_at);

comment on column event_settings.ends_at is
  'When the hunt closes and the dashboard board disappears. See 0024.';


-- ============================================================================
-- 2. The gate
--
-- One added clause, and it is the whole feature: every probe and every claim
-- in 0023 already routes through here.
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

revoke all on function event_hunt_open(uuid) from public, anon;


-- ============================================================================
-- 3. State
--
-- Two new facts for the UI: when this closes, and whether the board should be
-- on the page at all.
--
-- `visible` is deliberately a server-side answer rather than a date comparison
-- the client makes for itself. It is the same reasoning as the countdown: a
-- browser with a wrong clock should not be able to talk itself into a board
-- that is over, and -- more usefully -- flipping is_active off should clear
-- the board everywhere without a deploy.
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
      'participants', (select count(*) from event_participants)
    );
  end if;

  select * into v_participant from event_participants where user_id = v_user;

  v_current := event_current_level(v_user);
  select coalesce(array_agg(level order by level), '{}')
    into v_solved from event_solves where user_id = v_user;

  return jsonb_build_object(
    'active', true,

    -- What the dashboard card reads before it renders anything at all. Once
    -- the week is up this goes false for everybody and the board is gone --
    -- the prize is not, see the header note.
    'visible', not v_ended,

    'server_now', now(),
    'starts_at', v_settings.starts_at,
    'ends_at', v_settings.ends_at,
    'has_started', now() >= v_settings.starts_at,
    'has_ended', v_ended,

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

revoke all on function event_state() from public, anon;
grant execute on function event_state() to authenticated;


-- ============================================================================
-- 4. Joining
--
-- Refused once the week is up. Without this, an account could still enrol into
-- a finished event through the RPC and sit there permanently unable to play --
-- and it would count towards the participant total the board is quoting.
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

revoke all on function event_join() from public, anon;
grant execute on function event_join() to authenticated;
