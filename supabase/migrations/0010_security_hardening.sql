-- Security hardening.
--
-- Closes two exploitable holes that share one root cause: profiles rows were
-- client-writable column-wide. The profiles_update_self policy (0004) checks
-- *who* is updating but never *what* they change, and Supabase grants ALL on
-- public tables to `authenticated` by default, so PostgREST accepted a PATCH
-- on any column.
--
--   1. Self-promotion. is_admin() reads profiles.role, so any member could
--      PATCH {"role":"admin"} onto their own row and gain insert/update/DELETE
--      over the church's songs, plus rename the church.
--
--   2. Cross-tenant takeover. lock_profile_church() only raises when
--      old.church_id is not null, and every new signup starts at null. A fresh
--      account could PATCH {"church_id":"<any uuid>","role":"admin"} and land
--      inside someone else's church with full write access.
--
-- The fix is column-level privileges, so RLS is no longer the only thing
-- standing between a crafted request and a privilege escalation.

-- ============================================================================
-- 1. Column-level grants
-- ============================================================================

-- profiles: a user may rename themselves and mark the tour complete. Nothing
-- else. role and church_id are assigned by the database alone.
revoke update on public.profiles from authenticated;
grant update (name, onboarding_completed) on public.profiles to authenticated;

-- churches: an admin may edit the church's name and colour. created_by is set
-- once, on insert, by set_church_created_by() (0005) -- letting it be updated
-- handed a stranger SELECT access through the `or created_by = auth.uid()`
-- clause in churches_select_own (0006).
revoke update on public.churches from authenticated;
grant update (name, accent_color) on public.churches to authenticated;

-- ============================================================================
-- 2. Claim the new church for its creator, server-side
--
-- Onboarding used to do this from the browser:
--     update profiles set church_id = ..., role = 'admin'
-- which is exactly the write we just revoked. The database now does it, so the
-- client never needs -- or has -- permission to set either column.
-- ============================================================================

create or replace function claim_church_for_creator()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update profiles
  set church_id = new.id,
      role = 'admin'
  where id = new.created_by
    and church_id is null;

  return new;
end;
$$;

-- Runs before trg_churches_seed_hymns (triggers fire in name order); neither
-- depends on the other, since seeding sets church_id explicitly.
drop trigger if exists trg_churches_claim_creator on churches;
create trigger trg_churches_claim_creator
  after insert on churches
  for each row execute function claim_church_for_creator();

-- ============================================================================
-- 3. Cross-tenant foreign keys
--
-- These previously derived church_id only when the client omitted it
-- (`if new.church_id is null`). A client could therefore send its *own*
-- church_id while pointing song_id/set_id at another tenant's row, and pass
-- the `church_id = current_church_id()` check. Always derive from the parent
-- instead, ignoring whatever the client sent.
-- ============================================================================

create or replace function set_church_id_from_song()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.church_id := (select church_id from songs where id = new.song_id);
  if new.church_id is null then
    raise exception 'song not found';
  end if;
  return new;
end;
$$;

create or replace function set_church_id_from_worship_set()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  song_church uuid;
begin
  new.church_id := (select church_id from worship_sets where id = new.set_id);
  if new.church_id is null then
    raise exception 'worship set not found';
  end if;

  -- The set and the song are both client-supplied ids. They must belong to
  -- the same church, or a set could be built from another tenant's songs.
  select church_id into song_church from songs where id = new.song_id;
  if song_church is distinct from new.church_id then
    raise exception 'song does not belong to this church';
  end if;

  return new;
end;
$$;

-- Was declared `stable` while mutating NEW, which is the wrong volatility for
-- a BEFORE trigger.
create or replace function set_church_id_from_profile()
returns trigger
language plpgsql
security definer
volatile
set search_path = public
as $$
begin
  if new.church_id is null then
    new.church_id := (select church_id from profiles where id = auth.uid());
  end if;
  if new.church_id is null then
    raise exception 'cannot create this row: current user has no church assigned yet';
  end if;
  return new;
end;
$$;

-- ============================================================================
-- 4. Function hygiene
--
-- Both of these ran without a pinned search_path, which Supabase's linter
-- flags as function_search_path_mutable: a caller able to change search_path
-- could shadow an unqualified name the function relies on.
-- ============================================================================

create or replace function set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Redundant now that church_id cannot be granted to the client, but kept as
-- defence in depth: it still guards any future server-side path.
create or replace function lock_profile_church()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if old.church_id is not null and new.church_id is distinct from old.church_id then
    raise exception 'church_id cannot be changed once set';
  end if;
  return new;
end;
$$;
