-- Fix: onboarding could never create a church.
--
-- createChurchAndClaim() inserts into churches with a RETURNING clause
-- (supabase-js `.insert(...).select()`). PostgreSQL applies SELECT policies
-- to RETURNING rows, and reports a failure there with the *same* message as
-- a failed insert check: "new row violates row-level security policy".
--
-- The original SELECT policy was `id = current_church_id()`, but
-- current_church_id() reads profiles.church_id -- which is still null at
-- that moment, because the profile is only pointed at the new church
-- *after* the insert returns. So the row could be written but never read
-- back, and onboarding always failed.
--
-- Allowing a user to select churches they created breaks the cycle. This
-- doesn't widen access meaningfully: the creator becomes that church's
-- admin during onboarding anyway.

drop policy if exists "churches_select_own" on churches;

create policy "churches_select_own" on churches
  for select to authenticated
  using (id = current_church_id() or created_by = auth.uid());

-- Remove the temporary diagnostic helper added while tracking this down.
drop function if exists debug_auth_context();
