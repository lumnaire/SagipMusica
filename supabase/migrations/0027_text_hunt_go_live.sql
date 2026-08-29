-- Closing the preview door before the hunt goes live.
--
-- The localhost Start and Reset buttons are gone from the event board. That
-- alone would have made things WORSE rather than better: event_start_preview()
-- and event_reset_me() are RPCs, not buttons, and preview_enabled still
-- shipped `true` by default. Removing the UI removes the reminder that the
-- door is open; it does not close it. Anyone who read the network tab during
-- testing, or who reads this repository, could still have started the hunt
-- early and taken one of the five permanent Pro accounts.
--
-- So the flag goes off, and off by default.
--
-- Design notes:
--
--  * The functions and the column are kept, not dropped. 0023 and 0026 both
--    define event_reset_me() and both reference preview_enabled, and those
--    files are re-runnable by design -- dropping either would turn a re-run of
--    the repair migration into an error at exactly the moment somebody is
--    reaching for it because something is already wrong. Off is enough: both
--    functions check the flag first and raise 'Preview mode is off'.
--
--  * The default changes too, not just the row. A future rebuild from
--    migrations should come up closed, and a column whose default disagrees
--    with the deployed row is a trap for whoever next runs this from scratch.
--
-- ============================================================================
-- REHEARSING THE HUNT AFTER THIS
--
-- Don't re-enable preview. Move the window instead -- it exercises the real
-- clock-driven path rather than a bypass, which is the thing worth rehearsing:
--
--     update event_settings
--        set starts_at = now(), ends_at = now() + interval '1 hour'
--      where id = 1;
--
-- Put it back when you are done:
--
--     update event_settings set starts_at = default, ends_at = default where id = 1;
--
-- To see the announcement bar again on an account that has dismissed it:
--
--     delete from event_announcement_seen where user_id = '<uuid>';
--
-- To replay a whole account's hunt, clear its progress by hand:
--
--     delete from event_solves       where user_id = '<uuid>';
--     delete from event_participants where user_id = '<uuid>';
--     update profiles set subscription = 'free', subscription_granted_at = null
--      where id = '<uuid>';
-- ============================================================================

alter table event_settings alter column preview_enabled set default false;

update event_settings set preview_enabled = false where id = 1;

comment on column event_settings.preview_enabled is
  'Off in production (0027). Gates event_start_preview() and event_reset_me(); '
  'rehearse by moving starts_at/ends_at instead.';


-- ============================================================================
-- Diagnostic -- all three must be false/true as marked.
--
--   preview_enabled       must be FALSE. The door is shut.
--   preview_start_shut    must be TRUE.  event_start_preview() will refuse.
--   preview_reset_shut    must be TRUE.  event_reset_me() will refuse.
-- ============================================================================

select
  s.preview_enabled,
  not s.preview_enabled as preview_start_shut,
  not s.preview_enabled as preview_reset_shut,
  s.is_active           as event_is_on,
  s.starts_at,
  s.ends_at
from event_settings s
where s.id = 1;
