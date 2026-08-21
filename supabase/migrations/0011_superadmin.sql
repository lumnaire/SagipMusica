-- Superadmin: a single operator account that can see every church on the
-- platform and remove accounts.
--
-- Design notes:
--
--  * A superadmin belongs to NO church (church_id stays null). They are not a
--    church admin with extra powers -- they sit outside the tenant model, so
--    none of the existing church-scoped policies apply to them.
--
--  * Everything superadmin-facing goes through SECURITY DEFINER functions
--    rather than new RLS policies. Widening the SELECT policies on profiles
--    or songs to "or is_superadmin()" would change what every existing query
--    can see; a function keeps the blast radius to exactly these three calls.
--
--  * Each function re-checks is_superadmin() itself. EXECUTE is granted to
--    `authenticated`, so the check inside is the actual gate.
--
--  * The role cannot be granted from the browser: 0010 revoked UPDATE on
--    profiles.role from `authenticated`. Promotion happens via SQL only --
--    see the block at the bottom of this file.

-- ============================================================================
-- 1. Allow the new role
-- ============================================================================

alter table profiles drop constraint if exists profiles_role_check;
alter table profiles add constraint profiles_role_check
  check (role in ('admin', 'presenter', 'superadmin'));

-- ============================================================================
-- 2. Gate
-- ============================================================================

create or replace function is_superadmin()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from profiles where id = auth.uid() and role = 'superadmin'
  );
$$;

-- ============================================================================
-- 3. Platform-wide counters
-- ============================================================================

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
    'total_worship_sets', (select count(*) from worship_sets)
  );
end;
$$;

-- ============================================================================
-- 4. Every account on the platform
--
-- Reads auth.users for sign-in metadata the profiles table doesn't carry.
-- ============================================================================

create or replace function superadmin_list_accounts()
returns table (
  id uuid,
  email text,
  name text,
  role text,
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

-- ============================================================================
-- 5. Remove an account
--
-- Mirrors delete_own_account (0009): the auth user goes first so the profile
-- cascades away before the church is touched, otherwise the ON DELETE SET NULL
-- on profiles.church_id trips the lock_profile_church guard.
-- ============================================================================

create or replace function superadmin_delete_user(target_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  target_church uuid;
  target_role text;
  remaining_members int;
begin
  if not is_superadmin() then
    raise exception 'Not authorised';
  end if;

  if target_id = auth.uid() then
    raise exception 'You cannot delete your own superadmin account here';
  end if;

  select church_id, role into target_church, target_role
  from profiles where id = target_id;

  if not found then
    raise exception 'Account not found';
  end if;

  -- Guard against one operator removing another; demote in SQL first if that
  -- is really intended.
  if target_role = 'superadmin' then
    raise exception 'Cannot delete another superadmin account';
  end if;

  if target_church is not null then
    select count(*) into remaining_members
    from profiles
    where church_id = target_church and id <> target_id;
  end if;

  delete from auth.users where id = target_id;

  -- Last member out takes the church, its songs and its worship sets with
  -- them; otherwise nobody could ever reach that data again.
  if target_church is not null and remaining_members = 0 then
    delete from churches where id = target_church;
  end if;
end;
$$;

-- ============================================================================
-- 6. Privileges
-- ============================================================================

revoke all on function is_superadmin() from public, anon;
revoke all on function superadmin_stats() from public, anon;
revoke all on function superadmin_list_accounts() from public, anon;
revoke all on function superadmin_delete_user(uuid) from public, anon;

grant execute on function is_superadmin() to authenticated;
grant execute on function superadmin_stats() to authenticated;
grant execute on function superadmin_list_accounts() to authenticated;
grant execute on function superadmin_delete_user(uuid) to authenticated;

-- ============================================================================
-- 7. HOW TO CREATE YOUR SUPERADMIN  <-- read this
--
-- You cannot insert into auth.users by hand safely. Instead:
--
--   1. Sign up through the app as normal, with the email you want to use.
--   2. Verify the email (or confirm the user in the dashboard).
--   3. STOP -- do not complete onboarding. A superadmin should have no church.
--   4. Run the statement below with your email.
--
-- Then sign out and back in; the app routes you to /superadmin.
-- ============================================================================

-- update profiles
-- set role = 'superadmin'
-- where email = 'you@example.com';

-- If the account has ALREADY completed onboarding and owns a church, clearing
-- church_id trips the lock_profile_church guard, so disable it for the one
-- statement. (Its church is left intact and unreachable; delete it separately
-- if you don't want it.)
--
-- alter table profiles disable trigger trg_profiles_lock_church;
-- update profiles
-- set role = 'superadmin', church_id = null
-- where email = 'you@example.com';
-- alter table profiles enable trigger trg_profiles_lock_church;
