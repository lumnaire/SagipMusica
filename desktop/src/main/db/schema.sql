-- SagipMusica desktop schema.
--
-- A faithful SQLite translation of the Postgres schema in
-- supabase/migrations/0004_multitenant_rebuild.sql (tables, columns, CHECK
-- constraints) plus the hymn library tables from 0008 and the columns 0012
-- added to them. Column names and types are kept identical so the reused
-- React components and src/types/database.ts need no changes.
--
-- Differences from Postgres, all forced by the platform or by being
-- single-user and offline:
--
--   * uuid            -> text. Ids come from crypto.randomUUID() in main.
--   * timestamptz     -> text holding an ISO-8601 string, so values match the
--                        `created_at: string` shape the UI already expects.
--   * gen_random_uuid()/now() defaults -> explicit values from the repo layer,
--                        except updated_at which triggers maintain below.
--   * No RLS, no policies, no SECURITY DEFINER RPCs: one local user, so there
--     is no tenant boundary to enforce. church_id is retained and filled by
--     the repo layer, replacing the Postgres trigger that set it.
--   * No profiles table. app_settings holds the single local identity.

create table if not exists churches (
  id text primary key,
  name text not null,
  referral_source text
    check (referral_source is null or referral_source in
      ('facebook', 'youtube', 'linkedin', 'instagram', 'friend', 'other')),
  accent_color text not null default '#3730a3',
  created_by text,
  created_at text not null,
  updated_at text not null
);

-- The shared library. Platform-owned in the hosted app, and here it is simply
-- the read-only catalog that ships inside the installer. No church_id, exactly
-- as in Postgres. `title` is deliberately NOT unique: 0012 dropped that
-- constraint because the FBC hymnal repeats titles.
create table if not exists hymn_templates (
  id text primary key,
  title text not null,
  author text,
  composer text,
  category text,
  key text,
  tempo text,
  description text,
  status text not null default 'draft'
    check (status in ('draft', 'published')),
  is_starter integer not null default 0,
  copyright_status text not null default 'public_domain'
    check (copyright_status in ('public_domain', 'licensed', 'metadata_only')),
  order_index integer not null default 0,
  created_at text not null,
  updated_at text not null,
  updated_by text
);

create table if not exists hymn_template_sections (
  id text primary key,
  template_id text not null references hymn_templates (id) on delete cascade,
  type text not null default 'verse'
    check (type in ('verse', 'chorus', 'bridge', 'intro', 'outro', 'refrain', 'custom')),
  title text not null default '',
  lyrics text not null default '',
  order_index integer not null default 0
);

create table if not exists songs (
  id text primary key,
  church_id text not null references churches (id) on delete cascade,
  title text not null,
  author text,
  composer text,
  category text,
  key text,
  tempo text,
  description text,
  source_template_id text references hymn_templates (id) on delete set null,
  created_at text not null,
  updated_at text not null
);

create table if not exists song_sections (
  id text primary key,
  church_id text not null references churches (id) on delete cascade,
  song_id text not null references songs (id) on delete cascade,
  type text not null default 'verse'
    check (type in ('verse', 'chorus', 'bridge', 'intro', 'outro', 'refrain', 'custom')),
  title text not null default '',
  lyrics text not null default '',
  order_index integer not null default 0,
  created_at text not null,
  updated_at text not null
);

create table if not exists worship_sets (
  id text primary key,
  church_id text not null references churches (id) on delete cascade,
  name text not null,
  description text,
  created_at text not null,
  updated_at text not null
);

create table if not exists worship_set_items (
  id text primary key,
  church_id text not null references churches (id) on delete cascade,
  set_id text not null references worship_sets (id) on delete cascade,
  song_id text not null references songs (id) on delete cascade,
  order_index integer not null default 0,
  created_at text not null
);

-- Replaces the Supabase `profiles` row for a machine with no accounts, and
-- doubles as the store for one-off flags like whether the tour has run.
create table if not exists app_settings (
  key text primary key,
  value text
);

-- Mirrors idx_songs_church_template from 0012. SQLite supports partial
-- indexes, so this stays a partial unique index: a double-add raises
-- SQLITE_CONSTRAINT_UNIQUE, which the repo layer maps to AlreadyInHymnalError.
create unique index if not exists idx_songs_church_template
  on songs (church_id, source_template_id)
  where source_template_id is not null;

create index if not exists idx_songs_church on songs (church_id);
create index if not exists idx_song_sections_song on song_sections (song_id, order_index);
create index if not exists idx_worship_sets_church on worship_sets (church_id);
create index if not exists idx_worship_set_items_set on worship_set_items (set_id, order_index);
create index if not exists idx_hymn_templates_status on hymn_templates (status);
create index if not exists idx_hymn_templates_title on hymn_templates (title);
create index if not exists idx_hymn_template_sections_template
  on hymn_template_sections (template_id, order_index);

-- Stands in for Postgres set_updated_at(). `when new.updated_at = old.updated_at`
-- stops the trigger recursing when the repo layer sets updated_at itself.
create trigger if not exists trg_songs_updated_at
after update on songs
when new.updated_at = old.updated_at
begin
  update songs set updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') where id = new.id;
end;

create trigger if not exists trg_song_sections_updated_at
after update on song_sections
when new.updated_at = old.updated_at
begin
  update song_sections set updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') where id = new.id;
end;

create trigger if not exists trg_worship_sets_updated_at
after update on worship_sets
when new.updated_at = old.updated_at
begin
  update worship_sets set updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') where id = new.id;
end;

create trigger if not exists trg_churches_updated_at
after update on churches
when new.updated_at = old.updated_at
begin
  update churches set updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') where id = new.id;
end;
