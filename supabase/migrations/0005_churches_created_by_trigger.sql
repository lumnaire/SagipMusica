-- Defense in depth: derive churches.created_by server-side from auth.uid()
-- instead of trusting whatever value the client sends. Client-side session
-- state (React/Zustand, browser cache, HMR during dev) can go stale in ways
-- that are hard to diagnose from the outside; deriving this value in the
-- database, the same way church_id is already auto-filled on songs and
-- worship_sets (see 0004_multitenant_rebuild.sql), closes off the whole
-- class of bug where a mismatched created_by trips the
-- churches_insert_unclaimed RLS policy.

create or replace function set_church_created_by()
returns trigger as $$
begin
  new.created_by := auth.uid();
  return new;
end;
$$ language plpgsql security definer set search_path = public;

create trigger trg_churches_set_created_by before insert on churches
  for each row execute function set_church_created_by();
