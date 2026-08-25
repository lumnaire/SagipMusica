-- The "what's coming" board on the download page.
--
-- The download page tells visitors this is version one and asks them to send
-- suggestions, but it had nothing to show for it: no way to see that anything
-- was actually being worked on. This table is that list -- the superadmin
-- writes it, and the public download page reads it.
--
-- Design notes:
--
--  * Read by anon. The download page is public, so the published rows have to
--    be selectable with the anon key. Nothing else is: insert, update and
--    delete belong to the superadmin alone, checked in the policy rather than
--    trusted from the client.
--
--  * The read is split into two policies rather than one that says
--    `is_published or is_superadmin()`. is_superadmin() (0011) has EXECUTE
--    revoked from anon, so a single policy naming both roles would fail with a
--    permission error for signed-out visitors instead of returning the
--    published rows. Two permissive policies OR together and each only calls
--    what its own role may call.
--
--  * is_published exists so a half-written entry is not on the public site the
--    moment it is saved. New rows default to published, because the common
--    case is typing one line and wanting it up.
--
--  * Free text, length-capped in the database. These strings are rendered on a
--    public marketing page, so the cap is a real constraint and not a form
--    nicety -- it is what stops a crafted request putting an essay on the
--    download page.

-- ============================================================================
-- 1. Table
-- ============================================================================

create table if not exists platform_updates (
  id uuid primary key default gen_random_uuid(),

  title text not null
    check (length(btrim(title)) between 2 and 120),

  -- Optional: a headline alone is often the whole update.
  detail text
    check (detail is null or length(btrim(detail)) between 2 and 600),

  is_published boolean not null default true,

  -- Set by the trigger below, never by the client.
  created_by uuid references auth.users (id) on delete set null,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- The board is read newest-first, and only the published half of it.
create index if not exists idx_platform_updates_published
  on platform_updates (is_published, created_at desc);

drop trigger if exists trg_platform_updates_updated_at on platform_updates;
create trigger trg_platform_updates_updated_at
  before update on platform_updates
  for each row execute function set_updated_at();

-- created_by is stamped server-side for the same reason churches.created_by is
-- (0005): a column the client can write is a column the client can forge.
create or replace function set_platform_update_author()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.created_by := auth.uid();
  return new;
end;
$$;

drop trigger if exists trg_platform_updates_author on platform_updates;
create trigger trg_platform_updates_author
  before insert on platform_updates
  for each row execute function set_platform_update_author();

-- ============================================================================
-- 2. RLS
-- ============================================================================

alter table platform_updates enable row level security;

-- Supabase grants ALL on new public tables to anon and authenticated. Take it
-- back and hand out exactly what each role needs; the policies do the rest.
revoke all on table platform_updates from anon, authenticated;
grant select on table platform_updates to anon, authenticated;
grant insert, update, delete on table platform_updates to authenticated;

-- Anyone, signed in or not, sees the published rows. See the note above on why
-- this is not folded into the superadmin policy.
drop policy if exists "platform_updates_select_published" on platform_updates;
create policy "platform_updates_select_published" on platform_updates
  for select to anon, authenticated
  using (is_published);

-- The superadmin additionally sees unpublished drafts.
drop policy if exists "platform_updates_select_superadmin" on platform_updates;
create policy "platform_updates_select_superadmin" on platform_updates
  for select to authenticated
  using (is_superadmin());

drop policy if exists "platform_updates_insert_superadmin" on platform_updates;
create policy "platform_updates_insert_superadmin" on platform_updates
  for insert to authenticated
  with check (is_superadmin());

drop policy if exists "platform_updates_update_superadmin" on platform_updates;
create policy "platform_updates_update_superadmin" on platform_updates
  for update to authenticated
  using (is_superadmin())
  with check (is_superadmin());

drop policy if exists "platform_updates_delete_superadmin" on platform_updates;
create policy "platform_updates_delete_superadmin" on platform_updates
  for delete to authenticated
  using (is_superadmin());

-- ============================================================================
-- 3. Seed
--
-- Guarded on the table being empty rather than on the title, so re-running the
-- migration after the board has been edited never re-inserts an entry that was
-- deliberately deleted.
-- ============================================================================

insert into platform_updates (title, detail)
select
  'Built-in Bible for verse presentation',
  'Read and project Scripture without leaving SagipMusica. Look up a passage, send it to the screen, and keep the whole service — songs and readings — in one app.'
where not exists (select 1 from platform_updates);

-- ============================================================================
-- 4. Desktop downloads on the superadmin dashboard
--
-- download_signups (0014) has been collecting a row per installer handed out
-- since the survey shipped, but nothing ever showed the total. Added to the
-- stats blob rather than fetched separately so the dashboard keeps making one
-- round trip. Counted as rows, not as distinct churches: the same church
-- installing on a second computer is a second download, which is the number
-- this card is claiming to show.
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
    'total_worship_sets', (select count(*) from worship_sets),
    'total_library_songs', (select count(*) from hymn_templates where status = 'published'),
    'total_desktop_downloads', (select count(*) from download_signups)
  );
end;
$$;
