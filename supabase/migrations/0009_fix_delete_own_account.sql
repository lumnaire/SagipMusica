-- Fix: deleting your own account failed with
-- "church_id cannot be changed once set".
--
-- 0007 deleted the church first. Because profiles.church_id is declared
-- ON DELETE SET NULL, removing the church made Postgres null out the
-- owner's profiles.church_id -- which is exactly what the
-- lock_profile_church() guard from 0004 exists to reject. The guard was
-- firing on the database's own referential cleanup.
--
-- Deleting the auth user first removes the profile via cascade, so by the
-- time the church goes there is no profile row left to update and the guard
-- never runs. Same end state, no self-inflicted conflict.

create or replace function delete_own_account()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  my_church uuid;
  remaining_members int;
begin
  if uid is null then
    raise exception 'Not authenticated';
  end if;

  select church_id into my_church from profiles where id = uid;

  -- Decide the church's fate before the profile disappears.
  if my_church is not null then
    select count(*) into remaining_members
    from profiles
    where church_id = my_church and id <> uid;
  end if;

  -- Cascades to profiles, and nulls churches.created_by.
  delete from auth.users where id = uid;

  -- Only once nothing points at it: if this user was its last member, the
  -- church and its songs/worship sets go too (all ON DELETE CASCADE).
  -- Leaving it would strand data nobody could ever reach.
  if my_church is not null and remaining_members = 0 then
    delete from churches where id = my_church;
  end if;
end;
$$;

revoke all on function delete_own_account() from public, anon;
grant execute on function delete_own_account() to authenticated;
