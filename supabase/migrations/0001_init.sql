-- Church Worship Presentation & Hymnal Management System
-- Initial schema: tables, indexes, triggers, and Row Level Security policies.

create extension if not exists "pgcrypto";

-- ============================================================================
-- Tables
-- ============================================================================

create table if not exists profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  name text,
  role text not null default 'presenter' check (role in ('admin', 'presenter')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists songs (
  id uuid primary key default gen_random_uuid(),
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

create table if not exists song_sections (
  id uuid primary key default gen_random_uuid(),
  song_id uuid not null references songs (id) on delete cascade,
  type text not null default 'verse'
    check (type in ('verse', 'chorus', 'bridge', 'intro', 'outro', 'refrain', 'custom')),
  title text not null default '',
  lyrics text not null default '',
  order_index integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists section_media (
  id uuid primary key default gen_random_uuid(),
  section_id uuid not null references song_sections (id) on delete cascade,
  storage_path text not null,
  media_type text not null default 'notation' check (media_type in ('notation', 'background')),
  crop_x double precision not null default 0,
  crop_y double precision not null default 0,
  crop_width double precision not null default 0,
  crop_height double precision not null default 0,
  scale double precision not null default 1,
  position_x double precision not null default 0.5,
  position_y double precision not null default 0.5,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists worship_sets (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists worship_set_items (
  id uuid primary key default gen_random_uuid(),
  set_id uuid not null references worship_sets (id) on delete cascade,
  song_id uuid not null references songs (id) on delete cascade,
  order_index integer not null default 0,
  created_at timestamptz not null default now()
);

-- ============================================================================
-- Indexes
-- ============================================================================

create index if not exists idx_song_sections_song_id on song_sections (song_id, order_index);
create index if not exists idx_section_media_section_id on section_media (section_id);
create index if not exists idx_worship_set_items_set_id on worship_set_items (set_id, order_index);
create index if not exists idx_worship_set_items_song_id on worship_set_items (song_id);
create index if not exists idx_songs_category on songs (category);
create index if not exists idx_songs_title on songs (title);

-- ============================================================================
-- updated_at triggers
-- ============================================================================

create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger trg_profiles_updated_at before update on profiles
  for each row execute function set_updated_at();
create trigger trg_songs_updated_at before update on songs
  for each row execute function set_updated_at();
create trigger trg_song_sections_updated_at before update on song_sections
  for each row execute function set_updated_at();
create trigger trg_section_media_updated_at before update on section_media
  for each row execute function set_updated_at();
create trigger trg_worship_sets_updated_at before update on worship_sets
  for each row execute function set_updated_at();

-- Auto-create a profile row whenever a new auth user signs up.
-- Defaults to the 'presenter' role; promote to 'admin' manually in the
-- Supabase dashboard (Table Editor > profiles) for church staff accounts.
create or replace function handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'name', split_part(new.email, '@', 1)),
    'presenter'
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

alter table profiles enable row level security;
alter table songs enable row level security;
alter table song_sections enable row level security;
alter table section_media enable row level security;
alter table worship_sets enable row level security;
alter table worship_set_items enable row level security;

create or replace function is_admin()
returns boolean as $$
  select exists (
    select 1 from profiles where id = auth.uid() and role = 'admin'
  );
$$ language sql security definer stable set search_path = public;

-- profiles: users can read all profiles (needed to display presenter names),
-- but may only update their own, and only admins may change roles broadly.
create policy "profiles_select_authenticated" on profiles
  for select to authenticated using (true);

create policy "profiles_update_self" on profiles
  for update to authenticated using (id = auth.uid());

-- songs: any authenticated user may read; only admins may write.
create policy "songs_select_authenticated" on songs
  for select to authenticated using (true);
create policy "songs_insert_admin" on songs
  for insert to authenticated with check (is_admin());
create policy "songs_update_admin" on songs
  for update to authenticated using (is_admin());
create policy "songs_delete_admin" on songs
  for delete to authenticated using (is_admin());

-- song_sections: same pattern as songs.
create policy "song_sections_select_authenticated" on song_sections
  for select to authenticated using (true);
create policy "song_sections_insert_admin" on song_sections
  for insert to authenticated with check (is_admin());
create policy "song_sections_update_admin" on song_sections
  for update to authenticated using (is_admin());
create policy "song_sections_delete_admin" on song_sections
  for delete to authenticated using (is_admin());

-- section_media: same pattern.
create policy "section_media_select_authenticated" on section_media
  for select to authenticated using (true);
create policy "section_media_insert_admin" on section_media
  for insert to authenticated with check (is_admin());
create policy "section_media_update_admin" on section_media
  for update to authenticated using (is_admin());
create policy "section_media_delete_admin" on section_media
  for delete to authenticated using (is_admin());

-- worship_sets / worship_set_items: presenters and admins may both manage,
-- since presenters need to build and run their own service orders.
create policy "worship_sets_select_authenticated" on worship_sets
  for select to authenticated using (true);
create policy "worship_sets_insert_authenticated" on worship_sets
  for insert to authenticated with check (true);
create policy "worship_sets_update_authenticated" on worship_sets
  for update to authenticated using (true);
create policy "worship_sets_delete_authenticated" on worship_sets
  for delete to authenticated using (true);

create policy "worship_set_items_select_authenticated" on worship_set_items
  for select to authenticated using (true);
create policy "worship_set_items_insert_authenticated" on worship_set_items
  for insert to authenticated with check (true);
create policy "worship_set_items_update_authenticated" on worship_set_items
  for update to authenticated using (true);
create policy "worship_set_items_delete_authenticated" on worship_set_items
  for delete to authenticated using (true);
