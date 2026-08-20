-- SagipMusica multi-tenant rebuild.
--
-- This is a full wipe-and-rebuild of the schema introduced in 0001-0003:
-- the app is moving from a single, shared dataset (one church, hardcoded in
-- the UI) to a self-serve multi-tenant product where each signup creates
-- its own "church" workspace with fully isolated data. There is no
-- production data worth migrating, so existing tables are dropped and
-- recreated with a church_id on every row plus RLS scoped to it, rather
-- than attempting an in-place migration.
--
-- IMPORTANT: run this against a project you're prepared to fully reset.
-- After running it, also delete existing rows in auth.users (Dashboard ->
-- Authentication -> Users) -- this migration only touches public.*, and
-- handle_new_user() only fires on new auth.users inserts, so any
-- pre-existing auth users would otherwise be left with no matching
-- profiles row.

-- ============================================================================
-- Drop existing objects (dependency order; cascade drops policies/indexes/
-- triggers defined on each table automatically)
-- ============================================================================

drop trigger if exists trg_on_auth_user_created on auth.users;
drop function if exists handle_new_user();

-- Defensive: 0002_storage.sql / 0003_remove_notation_media.sql may or may
-- not have actually been run against this project. Cover both starting
-- states so this migration can't fail on a dependency it didn't expect.
--
-- Note: the "presentation-media" storage bucket itself is NOT dropped here.
-- Supabase blocks direct DELETE on storage.buckets via SQL ("Direct
-- deletion from storage tables is not allowed. Use the Storage API
-- instead."). If you want it gone, remove it manually from the Dashboard
-- (Storage -> presentation-media -> Delete bucket) -- it's an empty/unused
-- leftover either way and doesn't block anything below.
drop policy if exists "presentation_media_public_read" on storage.objects;
drop policy if exists "presentation_media_admin_insert" on storage.objects;
drop policy if exists "presentation_media_admin_update" on storage.objects;
drop policy if exists "presentation_media_admin_delete" on storage.objects;
drop table if exists section_media cascade;

drop table if exists worship_set_items cascade;
drop table if exists worship_sets cascade;
drop table if exists song_sections cascade;
drop table if exists songs cascade;
drop table if exists profiles cascade;

drop function if exists is_admin();

-- set_updated_at() is reused as-is below, so it is intentionally not dropped.

-- ============================================================================
-- Tables
-- ============================================================================

create table churches (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  referral_source text
    check (referral_source in ('facebook', 'youtube', 'linkedin', 'instagram', 'friend', 'other')),
  accent_color text not null default '#3730a3',
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  church_id uuid references churches (id) on delete set null,
  email text not null,
  name text,
  role text not null default 'presenter' check (role in ('admin', 'presenter')),
  onboarding_completed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table songs (
  id uuid primary key default gen_random_uuid(),
  church_id uuid not null references churches (id) on delete cascade,
  title text not null,
  author text,
  composer text,
  category text,
  key text,
  tempo text,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table song_sections (
  id uuid primary key default gen_random_uuid(),
  church_id uuid not null references churches (id) on delete cascade,
  song_id uuid not null references songs (id) on delete cascade,
  type text not null default 'verse'
    check (type in ('verse', 'chorus', 'bridge', 'intro', 'outro', 'refrain', 'custom')),
  title text not null default '',
  lyrics text not null default '',
  order_index integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table worship_sets (
  id uuid primary key default gen_random_uuid(),
  church_id uuid not null references churches (id) on delete cascade,
  name text not null,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table worship_set_items (
  id uuid primary key default gen_random_uuid(),
  church_id uuid not null references churches (id) on delete cascade,
  set_id uuid not null references worship_sets (id) on delete cascade,
  song_id uuid not null references songs (id) on delete cascade,
  order_index integer not null default 0,
  created_at timestamptz not null default now()
);

-- ============================================================================
-- Indexes
-- ============================================================================

create index idx_profiles_church_id on profiles (church_id);

create index idx_songs_church_id on songs (church_id);
create index idx_songs_category on songs (category);
create index idx_songs_title on songs (title);

create index idx_song_sections_church_id on song_sections (church_id);
create index idx_song_sections_song_id on song_sections (song_id, order_index);

create index idx_worship_sets_church_id on worship_sets (church_id);

create index idx_worship_set_items_church_id on worship_set_items (church_id);
create index idx_worship_set_items_set_id on worship_set_items (set_id, order_index);
create index idx_worship_set_items_song_id on worship_set_items (song_id);

-- ============================================================================
-- updated_at triggers (set_updated_at() already exists from 0001)
-- ============================================================================

create trigger trg_churches_updated_at before update on churches
  for each row execute function set_updated_at();
create trigger trg_profiles_updated_at before update on profiles
  for each row execute function set_updated_at();
create trigger trg_songs_updated_at before update on songs
  for each row execute function set_updated_at();
create trigger trg_song_sections_updated_at before update on song_sections
  for each row execute function set_updated_at();
create trigger trg_worship_sets_updated_at before update on worship_sets
  for each row execute function set_updated_at();

-- ============================================================================
-- church_id auto-fill triggers
--
-- None of the existing client insert call sites (src/features/songs/api.ts,
-- src/features/worship-sets/api.ts) set a tenant column -- they were written
-- for the old single-tenant schema. Rather than touch every call site,
-- church_id is derived server-side on insert. Postgres runs BEFORE ROW
-- triggers before evaluating a policy's WITH CHECK clause, so the RLS
-- policies below see the populated value.
-- ============================================================================

create or replace function set_church_id_from_profile()
returns trigger as $$
begin
  if new.church_id is null then
    new.church_id := (select church_id from profiles where id = auth.uid());
  end if;
  if new.church_id is null then
    raise exception 'cannot create this row: current user has no church assigned yet';
  end if;
  return new;
end;
$$ language plpgsql security definer stable set search_path = public;

create trigger trg_songs_set_church_id before insert on songs
  for each row execute function set_church_id_from_profile();
create trigger trg_worship_sets_set_church_id before insert on worship_sets
  for each row execute function set_church_id_from_profile();

create or replace function set_church_id_from_song()
returns trigger as $$
begin
  if new.church_id is null then
    new.church_id := (select church_id from songs where id = new.song_id);
  end if;
  return new;
end;
$$ language plpgsql security definer set search_path = public;

create trigger trg_song_sections_set_church_id before insert on song_sections
  for each row execute function set_church_id_from_song();

create or replace function set_church_id_from_worship_set()
returns trigger as $$
begin
  if new.church_id is null then
    new.church_id := (select church_id from worship_sets where id = new.set_id);
  end if;
  return new;
end;
$$ language plpgsql security definer set search_path = public;

create trigger trg_worship_set_items_set_church_id before insert on worship_set_items
  for each row execute function set_church_id_from_worship_set();

-- Once a profile has a church, it cannot be reassigned by the user (the
-- profiles_update_self policy below only checks id = auth.uid(), so this
-- trigger is what actually stops a user from moving between churches).
create or replace function lock_profile_church()
returns trigger as $$
begin
  if old.church_id is not null and new.church_id is distinct from old.church_id then
    raise exception 'church_id cannot be changed once set';
  end if;
  return new;
end;
$$ language plpgsql;

create trigger trg_profiles_lock_church before update on profiles
  for each row execute function lock_profile_church();

-- Auto-create a profile row whenever a new auth user signs up. A brand new
-- user has no church yet -- they get one by completing onboarding, which
-- inserts into churches and sets profiles.church_id/role itself.
create or replace function handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, name, role, church_id, onboarding_completed)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'name', split_part(new.email, '@', 1)),
    'presenter',
    null,
    false
  );
  return new;
end;
$$ language plpgsql security definer set search_path = public;

create trigger trg_on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- ============================================================================
-- Row Level Security
-- ============================================================================

alter table churches enable row level security;
alter table profiles enable row level security;
alter table songs enable row level security;
alter table song_sections enable row level security;
alter table worship_sets enable row level security;
alter table worship_set_items enable row level security;

create or replace function current_church_id()
returns uuid as $$
  select church_id from profiles where id = auth.uid();
$$ language sql security definer stable set search_path = public;

create or replace function is_admin()
returns boolean as $$
  select exists (
    select 1 from profiles where id = auth.uid() and role = 'admin'
  );
$$ language sql security definer stable set search_path = public;

-- churches: members can read their own church; only its creator (while not
-- yet a member of any church) can create one; only an admin of that church
-- can update it. No delete policy -- church deletion is out of scope.
--
-- NOTE: this select policy is superseded by 0006_fix_churches_select_policy.sql,
-- which also allows `created_by = auth.uid()`. Without that, an insert with a
-- RETURNING clause fails, because the creator's profile isn't pointed at the
-- new church until after the insert completes.
create policy "churches_select_own" on churches
  for select to authenticated using (id = current_church_id());

create policy "churches_insert_unclaimed" on churches
  for insert to authenticated
  with check (created_by = auth.uid() and current_church_id() is null);

create policy "churches_update_admin" on churches
  for update to authenticated using (id = current_church_id() and is_admin());

-- profiles: users can read profiles in their own church (needed to display
-- presenter names), plus always their own row (needed before onboarding,
-- while church_id is still null and current_church_id() resolves to
-- nothing). Users may only update their own row; the trigger above is what
-- actually prevents changing church_id once set. No insert policy --
-- rows are only ever created by handle_new_user(), which runs as the
-- trigger owner and bypasses RLS.
create policy "profiles_select_own_church" on profiles
  for select to authenticated using (church_id = current_church_id() or id = auth.uid());

create policy "profiles_update_self" on profiles
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

-- songs / song_sections: any member of the church may read; only admins may
-- write. Same pattern as 0001, scoped by church_id.
create policy "songs_select_own_church" on songs
  for select to authenticated using (church_id = current_church_id());
create policy "songs_insert_admin" on songs
  for insert to authenticated with check (church_id = current_church_id() and is_admin());
create policy "songs_update_admin" on songs
  for update to authenticated using (church_id = current_church_id() and is_admin());
create policy "songs_delete_admin" on songs
  for delete to authenticated using (church_id = current_church_id() and is_admin());

create policy "song_sections_select_own_church" on song_sections
  for select to authenticated using (church_id = current_church_id());
create policy "song_sections_insert_admin" on song_sections
  for insert to authenticated with check (church_id = current_church_id() and is_admin());
create policy "song_sections_update_admin" on song_sections
  for update to authenticated using (church_id = current_church_id() and is_admin());
create policy "song_sections_delete_admin" on song_sections
  for delete to authenticated using (church_id = current_church_id() and is_admin());

-- worship_sets / worship_set_items: any member of the church may manage,
-- since presenters need to build and run their own service orders.
create policy "worship_sets_select_own_church" on worship_sets
  for select to authenticated using (church_id = current_church_id());
create policy "worship_sets_insert_own_church" on worship_sets
  for insert to authenticated with check (church_id = current_church_id());
create policy "worship_sets_update_own_church" on worship_sets
  for update to authenticated using (church_id = current_church_id());
create policy "worship_sets_delete_own_church" on worship_sets
  for delete to authenticated using (church_id = current_church_id());

create policy "worship_set_items_select_own_church" on worship_set_items
  for select to authenticated using (church_id = current_church_id());
create policy "worship_set_items_insert_own_church" on worship_set_items
  for insert to authenticated with check (church_id = current_church_id());
create policy "worship_set_items_update_own_church" on worship_set_items
  for update to authenticated using (church_id = current_church_id());
create policy "worship_set_items_delete_own_church" on worship_set_items
  for delete to authenticated using (church_id = current_church_id());
