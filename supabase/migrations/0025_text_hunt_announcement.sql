-- The grand entrance: announcing the 3-Text Hunt once, to each account.
--
-- The board (0023) has been sitting on the dashboard since the migration was
-- applied, and a card that appears quietly among the stat tiles is a card most
-- people scroll past. The event only runs for a week, so "they'll notice it
-- eventually" is not good enough — everybody signed in today, and everybody
-- who signs up between now and the close, gets told once, properly, with the
-- same celebration the winners get.
--
-- Design notes:
--
--  * Once per ACCOUNT, not once per browser. localStorage would have been a
--    line of code, and would have shown the same fanfare again on the tablet
--    at the sound desk, and again after a cache clear. A row here is the
--    account's memory of having been told, wherever it signs in from.
--
--  * Its own table rather than a column on profiles. profiles is a shared type
--    across the web app and the desktop build, and the desktop build has no
--    accounts and no event; widening it there for something that build can
--    never use would push this feature into a place it does not belong. This
--    table lives entirely inside the event feature, which the desktop already
--    stubs out wholesale.
--
--  * Acknowledging is idempotent and never un-acknowledges. There is no RPC to
--    make the announcement show again, on purpose: the only thing that could
--    want one is a test, and event_reset_me() already covers that by deleting
--    the row along with the rest of the account's event state.
--
--  * The announcement is tied to `visible`, so it cannot fire for the first
--    time after the hunt has closed. An account that never signed in during
--    the week is not shown a fanfare for something it can no longer play.

-- ============================================================================
-- 1. Who has been told
-- ============================================================================

create table if not exists event_announcement_seen (
  user_id uuid primary key references auth.users (id) on delete cascade,
  seen_at timestamptz not null default now()
);

alter table event_announcement_seen enable row level security;
revoke all on table event_announcement_seen from anon, authenticated;

-- No policies, like the rest of the event tables: everything goes through the
-- definer functions below.

-- event_reset_me() predates this table, so it has to learn about it — the
-- localhost Reset button is what makes the announcement testable more than
-- once, and it would be quietly broken otherwise.
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
-- 2. Acknowledging it
-- ============================================================================

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

-- ============================================================================
-- 3. State
--
-- Two changes: `announcement_seen`, and the anon branch is opened up so the
-- landing page can ask whether the event is still on.
--
-- Granting this to anon is safe and deliberate. The signed-out branch returns
-- five things — is it on, when does it open, when does it close, has it
-- started, how many have joined — and returns before it touches a single
-- account-scoped query. It is the same class of endpoint as
-- public_platform_stats() (0017): counts and dates, no rows.
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

    -- Drives the one-time welcome. False for every account that has not been
    -- shown it yet, which on the day this ships is every account there is.
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
-- 4. Grants
-- ============================================================================

revoke all on function event_state() from public, anon;
revoke all on function event_ack_announcement() from public, anon;
revoke all on function event_reset_me() from public, anon;

-- anon included here and nowhere else in this feature. See the note above.
grant execute on function event_state() to anon, authenticated;
grant execute on function event_ack_announcement() to authenticated;
grant execute on function event_reset_me() to authenticated;
