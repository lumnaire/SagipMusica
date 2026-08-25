-- Promote an existing account to superadmin.
--
-- Run this in the Supabase SQL editor, which connects as the table owner and
-- bypasses RLS. It is NOT a migration: migrations describe the schema, and
-- accounts are not schema.
--
-- The account is created by Supabase's own auth service -- by signing up
-- through the app, exactly like every other account -- and this script changes
-- one column afterwards. Nothing here hand-writes auth.users, so nothing here
-- can drift out of step with a future GoTrue release.
--
-- ============================================================================
-- STEPS
-- ============================================================================
--
--   1. Have them sign up through the app as normal -- email/password or
--      "Continue with Google", either is fine.
--
--   2. If they signed up with a password, they verify their email. Google
--      accounts arrive verified. (The check below tells you if this is still
--      outstanding: a promoted account that cannot sign in is just a confusing
--      way to be locked out.)
--
--   3. STOP -- they must NOT complete onboarding. A superadmin sits outside
--      the tenant model and must have no church: landingPathFor() in
--      src/lib/auth-routing.ts sends anyone with a church_id to a church
--      dashboard instead of /superadmin. This script refuses to promote an
--      account that already has one.
--
--   4. Put their email on the marked line below and run the whole file.
--
--   5. They sign out and back in. The app routes them to /superadmin.
--
-- To undo one, set the role back to 'presenter' -- the same statement with a
-- different value. Nothing else about the account changes either way.

do $$
declare
  v_email text := 'name@example.com';   -- <<< EDIT ME
  v_profile public.profiles;
  v_confirmed_at timestamptz;
begin
  select * into v_profile
  from public.profiles
  where lower(email) = lower(v_email);

  if not found then
    raise exception
      'No account for %. Have them sign up through the app first (step 1).',
      v_email;
  end if;

  -- Guarding rather than silently clearing it: an account with a church is
  -- somebody's admin, and quietly cutting them loose from their hymnal is not
  -- a side effect a promotion should have.
  if v_profile.church_id is not null then
    raise exception
      'Account % belongs to a church (%). A superadmin must have no church -- '
      'promote a fresh account that stopped before onboarding instead.',
      v_email, v_profile.church_id;
  end if;

  if v_profile.role = 'superadmin' then
    raise notice '% is already a superadmin. Nothing to do.', v_email;
    return;
  end if;

  update public.profiles
  set role = 'superadmin'
  where id = v_profile.id;

  -- A warning, not a refusal: the promotion is still correct, they just have a
  -- verification link to click before it does them any good.
  select email_confirmed_at into v_confirmed_at
  from auth.users
  where id = v_profile.id;

  if v_confirmed_at is null then
    raise warning
      'Promoted %, but the email is not verified yet -- they cannot sign in '
      'until they click the verification link (step 2).',
      v_email;
  else
    raise notice 'Promoted % (%) to superadmin.', v_email, v_profile.id;
  end if;
end $$;

-- ============================================================================
-- Check your work
-- ============================================================================
--
-- Every superadmin, and proof that none of them holds a church.

select
  p.email,
  p.name,
  p.role,
  p.church_id,
  u.email_confirmed_at is not null as email_confirmed,
  u.last_sign_in_at
from public.profiles p
join auth.users u on u.id = p.id
where p.role = 'superadmin'
order by p.created_at;
