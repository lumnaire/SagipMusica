-- Account self-management: let a signed-in user delete their own account.
--
-- Deleting from auth.users requires privileges the browser's anon key
-- doesn't have (and the service_role key must never reach the frontend),
-- so this is exposed as a SECURITY DEFINER function the user can call for
-- their own account only -- auth.uid() decides whose row is removed, so
-- there is no parameter a caller could tamper with.

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

  -- If this user was the last member of their church, take the church (and
  -- its songs/worship sets, via on delete cascade) with them. Leaving it
  -- behind would strand data nobody can ever reach again. A church with
  -- other members is left untouched.
  if my_church is not null then
    select count(*) into remaining_members
    from profiles
    where church_id = my_church and id <> uid;

    if remaining_members = 0 then
      delete from churches where id = my_church;
    end if;
  end if;

  -- profiles cascades from auth.users, so this removes both.
  delete from auth.users where id = uid;
end;
$$;

revoke all on function delete_own_account() from public, anon;
grant execute on function delete_own_account() to authenticated;
