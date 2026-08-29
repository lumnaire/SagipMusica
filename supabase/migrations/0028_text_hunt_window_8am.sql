-- The real event window: 8AM to 8AM, and revoking the test accounts' early access.
--
-- Two things, and the second is the reason the first was noticed.
--
-- ============================================================================
-- 1. WHY THE COUNTDOWN SAID "22d"
--
-- It was counting down to the wrong end of the event, for a reason that is a
-- genuine hole rather than a display bug.
--
-- The board shows "Starts in" when the hunt is shut and "Closes in" when it is
-- open. Any account that pressed the old localhost Start button still has
-- event_participants.preview_started_at set, and event_hunt_open() treated a
-- non-null value there as "this account may play" -- unconditionally, without
-- consulting preview_enabled. So for every account used in testing the hunt
-- was still OPEN: the board was counting down to the close (21 September)
-- rather than to the start (14 September), which from late August is about 22
-- days.
--
-- 0027 turned preview_enabled off, and that was not enough. It stopped anyone
-- NEW starting a preview; it did nothing about the accounts already holding
-- one. Those accounts could have played the whole hunt before 14 September and
-- taken all five permanent Pro slots before anybody else could reach it.
--
-- Both halves are closed below: the stale flags are cleared, and
-- event_hunt_open() now requires preview_enabled as well, so switching the
-- flag off revokes every outstanding preview at once instead of merely
-- refusing to issue new ones.
--
-- ============================================================================
-- 2. THE WINDOW
--
-- 08:00 to 08:00 Philippine time, 14 to 21 September 2026. Still exactly seven
-- days; it just no longer opens and closes while the country is asleep.
-- Midnight was a poor choice for something a worship team is meant to notice
-- and take part in together.
-- ============================================================================


-- ============================================================================
-- The window
--
-- Defaults as well as the row: a database rebuilt from migrations must come up
-- with the same window as the one that is deployed, or `set starts_at =
-- default` (which the rehearsal instructions use to undo a test) silently
-- restores midnight.
-- ============================================================================

alter table event_settings alter column starts_at set default '2026-09-14 08:00:00+08';
alter table event_settings alter column ends_at   set default '2026-09-21 08:00:00+08';

update event_settings
   set starts_at = '2026-09-14 08:00:00+08',
       ends_at   = '2026-09-21 08:00:00+08'
 where id = 1;


-- ============================================================================
-- Revoking the previews handed out during testing
--
-- Unconditional, and it is meant to be. There is no account that should be
-- inside the hunt before 14 September, and the only rows with this set are the
-- ones used to build the thing.
--
-- Their progress is cleared too. A test account that solved all three
-- challenges is holding a winner_rank and a Pro subscription that came from a
-- rehearsal, and leaving those in place would hand out prize slots that nobody
-- competed for -- the five would be gone before the event opened.
-- ============================================================================

update event_participants set preview_started_at = null;

with rehearsals as (
  delete from event_participants
   where completed_at is not null or winner_rank is not null
  returning user_id
)
update profiles
   set subscription = 'free', subscription_granted_at = null
 where id in (select user_id from rehearsals);

-- Anything left behind by the deletes above.
delete from event_solves
 where user_id not in (select user_id from event_participants);


-- ============================================================================
-- The gate
--
-- One added condition: a preview only counts while previews are enabled. This
-- is what makes `update event_settings set preview_enabled = false` a real
-- off switch rather than a "no new previews" switch -- the difference between
-- the two is five permanent Pro accounts.
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
    -- The close, which no account gets past.
    and now() < (select ends_at from event_settings where id = 1)
    and (
      -- The open...
      now() >= (select starts_at from event_settings where id = 1)
      -- ...or a preview, which is only a thing while previews are on.
      or (
        coalesce((select preview_enabled from event_settings where id = 1), false)
        and exists (
          select 1 from event_participants
          where user_id = p_user and preview_started_at is not null
        )
      )
    );
$$;

revoke all on function event_hunt_open(uuid) from public, anon;


-- ============================================================================
-- Diagnostic -- read this output
--
--   opens_manila / closes_manila   must be 2026-09-14 08:00 / 2026-09-21 08:00
--   window_days                    must be 7
--   hunt_open_now                  must be FALSE until 14 September
--   stale_previews                 must be 0
--   rehearsal_pro_accounts         must be 0
-- ============================================================================

select
  to_char(s.starts_at at time zone 'Asia/Manila', 'YYYY-MM-DD HH24:MI') as opens_manila,
  to_char(s.ends_at   at time zone 'Asia/Manila', 'YYYY-MM-DD HH24:MI') as closes_manila,
  (extract(epoch from (s.ends_at - s.starts_at)) / 86400)::int          as window_days,
  now() >= s.starts_at and now() < s.ends_at                            as hunt_open_now,
  s.preview_enabled,
  (select count(*) from event_participants where preview_started_at is not null)
                                                                        as stale_previews,
  (select count(*) from event_participants where winner_rank is not null)
                                                                        as prize_slots_taken,
  (select count(*) from profiles where subscription = 'pro')            as rehearsal_pro_accounts
from event_settings s
where s.id = 1;
