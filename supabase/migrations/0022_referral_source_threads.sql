-- "Threads" joins the list of answers to "where did you hear about us?".
--
-- The set of allowed values is a CHECK constraint on churches.referral_source,
-- written inline by 0004, so adding an option means replacing the constraint.
-- Until that happens the column rejects the value and onboarding fails at the
-- last step with a 400 — the app's REFERRAL_SOURCE_LABELS and this constraint
-- have to move together.

-- 0004 wrote the constraint inline, which means Postgres named it, and the
-- name it chose is not something to bet a migration on. Find it by what it
-- constrains instead. This also cleans up after any earlier hand-patching that
-- left a second constraint on the column.
do $$
declare
  existing record;
begin
  for existing in
    select conname
      from pg_constraint
     where conrelid = 'public.churches'::regclass
       and contype = 'c'
       and pg_get_constraintdef(oid) ilike '%referral_source%'
  loop
    execute format('alter table churches drop constraint %I', existing.conname);
  end loop;
end $$;

alter table churches
  add constraint churches_referral_source_check
  check (referral_source in (
    'facebook',
    'youtube',
    'linkedin',
    'instagram',
    'threads',
    'friend',
    'other'
  ));

-- Named explicitly this time, so the next option to be added can drop it by
-- name and this block never has to be written again.
