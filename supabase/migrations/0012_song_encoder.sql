-- Song encoder: a platform-level account whose job is maintaining the shared
-- hymn library that church admins pull songs from.
--
-- Design notes:
--
--  * Like a superadmin, an encoder belongs to NO church (church_id stays null).
--    They sit outside the tenant model, so no church-scoped policy applies to
--    them and they can never see a church's own songs.
--
--  * 0008 shipped hymn_templates as reference data: readable by everyone,
--    writable by nobody, maintained by editing migrations. This migration turns
--    it into a living catalog with draft/published states and an owner.
--
--  * Unlike superadmin, encoder writes go through ordinary RLS policies rather
--    than SECURITY DEFINER functions. The reason it is safe here: a template is
--    invisible to admins until it is published, so a save that fails halfway
--    leaves a broken DRAFT, not a broken song in somebody's hymnal. That is the
--    atomicity guarantee the RPCs would have bought, for free.
--
--  * Distribution is PULL, not push. Publishing does not touch any church. An
--    admin browses the catalog and copies a song in, and from that moment the
--    copy is theirs -- later encoder edits never reach it.
--
--  * New churches keep receiving exactly the original 20 starter hymns (see
--    is_starter below), not the whole catalog. A church that signs up when the
--    library holds 500 songs should not open a hymnal with 500 songs in it.

-- ============================================================================
-- 1. Allow the new role
-- ============================================================================

alter table profiles drop constraint if exists profiles_role_check;
alter table profiles add constraint profiles_role_check
  check (role in ('admin', 'presenter', 'superadmin', 'encoder'));

-- ============================================================================
-- 2. Gate
-- ============================================================================

create or replace function is_encoder()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from profiles where id = auth.uid() and role = 'encoder'
  );
$$;

revoke all on function is_encoder() from public, anon;
grant execute on function is_encoder() to authenticated;

-- ============================================================================
-- 3. Catalog metadata on hymn_templates
-- ============================================================================

alter table hymn_templates
  add column if not exists status text not null default 'draft',
  add column if not exists is_starter boolean not null default false,
  add column if not exists copyright_status text not null default 'public_domain',
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now(),
  add column if not exists updated_by uuid references profiles (id) on delete set null;

alter table hymn_templates drop constraint if exists hymn_templates_status_check;
alter table hymn_templates add constraint hymn_templates_status_check
  check (status in ('draft', 'published'));

-- Carries 0008's copyright care into the UI. An encoder publishing to every
-- church on the platform needs the licence question in front of them, not
-- buried in a migration comment.
--   public_domain  - lyrics are free to reproduce
--   licensed       - lyrics included, church needs its own CCLI cover
--   metadata_only  - deliberately shipped without lyrics
alter table hymn_templates drop constraint if exists hymn_templates_copyright_status_check;
alter table hymn_templates add constraint hymn_templates_copyright_status_check
  check (copyright_status in ('public_domain', 'licensed', 'metadata_only'));

-- Identity moves to songs.source_template_id below, so the title no longer has
-- to be unique. Two hymns really can share a name.
alter table hymn_templates drop constraint if exists hymn_templates_title_key;

drop trigger if exists trg_hymn_templates_updated_at on hymn_templates;
create trigger trg_hymn_templates_updated_at before update on hymn_templates
  for each row execute function set_updated_at();

-- Everything already in the table is the original starter set from 0008.
update hymn_templates set status = 'published', is_starter = true;

-- The two 0008 seeded as metadata only -- still under copyright, no lyrics.
update hymn_templates
set copyright_status = 'metadata_only'
where title in ('How Great Thou Art', 'Victory in Jesus');

create index if not exists idx_hymn_templates_status
  on hymn_templates (status, order_index);

-- ============================================================================
-- 4. Provenance on songs
--
-- ON DELETE SET NULL, deliberately: retiring a template must never delete the
-- copy a church has been singing from for two years.
-- ============================================================================

alter table songs
  add column if not exists source_template_id uuid
    references hymn_templates (id) on delete set null;

-- Lets the library page show an "Added" state cheaply, and makes a double-add
-- a database error rather than a duplicate song.
create unique index if not exists idx_songs_church_template
  on songs (church_id, source_template_id)
  where source_template_id is not null;

-- Backfill songs seeded by 0008. Title is the only link those rows have, and
-- this is the last moment it is trustworthy: the template titles are still the
-- original 20 unique ones, and nothing after this may join on title.
--
-- DISTINCT ON matters. A church that hand-added its own "Amazing Grace"
-- alongside the seeded one has two rows matching the same template, and
-- claiming both would violate idx_songs_church_template and abort the
-- migration. The oldest row per church wins -- that is the seeded copy.
with matched as (
  select distinct on (s.church_id, t.id)
    s.id as song_id,
    t.id as template_id
  from songs s
  join hymn_templates t on t.title = s.title
  where s.source_template_id is null
  order by s.church_id, t.id, s.created_at, s.id
)
update songs s
set source_template_id = m.template_id
from matched m
where s.id = m.song_id;

-- ============================================================================
-- 5. Re-seed function
--
-- Replaces the version in 0008. Two changes, both load-bearing:
--
--   * Only is_starter templates are copied, so the encoder's catalog does not
--     flood every new signup.
--
--   * The section copy joins on source_template_id instead of s.title = t.title.
--     That title join only worked because hymn_templates.title was unique; now
--     that an encoder can add a colliding title, it would silently staple one
--     hymn's lyrics onto another hymn.
-- ============================================================================

create or replace function seed_church_hymns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- church_id is set explicitly here: the auto-fill trigger on songs reads it
  -- from the caller's profile, which is not pointed at this church yet during
  -- onboarding.
  insert into songs (church_id, title, author, composer, category, key, tempo, description, source_template_id)
  select new.id, t.title, t.author, t.composer, t.category, t.key, t.tempo, t.description, t.id
  from hymn_templates t
  where t.is_starter and t.status = 'published'
  order by t.order_index;

  insert into song_sections (church_id, song_id, type, title, lyrics, order_index)
  select new.id, s.id, ts.type, ts.title, ts.lyrics, ts.order_index
  from hymn_template_sections ts
  join songs s on s.church_id = new.id and s.source_template_id = ts.template_id;

  return new;
end;
$$;

-- ============================================================================
-- 6. RLS
--
-- The catalog is meant to be readable by every signed-in user -- that is the
-- whole point of a shared library -- so here, unlike superadmin, widening the
-- SELECT policy is the correct move. The one thing that must not leak is a
-- draft: work in progress is the encoder's alone until they publish it.
-- ============================================================================

drop policy if exists "hymn_templates_read" on hymn_templates;
create policy "hymn_templates_read" on hymn_templates
  for select to authenticated
  using (status = 'published' or is_encoder());

drop policy if exists "hymn_template_sections_read" on hymn_template_sections;
create policy "hymn_template_sections_read" on hymn_template_sections
  for select to authenticated
  using (
    exists (
      select 1 from hymn_templates t
      where t.id = template_id
        and (t.status = 'published' or is_encoder())
    )
  );

-- Writes: same shape as songs in 0004 -- table-level grant to `authenticated`,
-- with the policy doing the actual gating.
drop policy if exists "hymn_templates_write" on hymn_templates;
create policy "hymn_templates_write" on hymn_templates
  for all to authenticated
  using (is_encoder())
  with check (is_encoder());

drop policy if exists "hymn_template_sections_write" on hymn_template_sections;
create policy "hymn_template_sections_write" on hymn_template_sections
  for all to authenticated
  using (is_encoder())
  with check (is_encoder());

grant insert, update, delete on hymn_templates to authenticated;
grant insert, update, delete on hymn_template_sections to authenticated;

-- ============================================================================
-- 7. Role management for the superadmin
--
-- Deliberately narrow. 'admin' is earned by creating a church (see
-- claim_church_for_creator in 0010) and 'superadmin' stays SQL-only, so the
-- only transitions offered here are presenter <-> encoder.
-- ============================================================================

create or replace function superadmin_set_role(target_id uuid, new_role text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  target_role text;
  target_church uuid;
begin
  if not is_superadmin() then
    raise exception 'Not authorised';
  end if;

  if target_id = auth.uid() then
    raise exception 'You cannot change your own role';
  end if;

  if new_role not in ('presenter', 'encoder') then
    raise exception 'Role must be presenter or encoder';
  end if;

  select role, church_id into target_role, target_church
  from profiles where id = target_id;

  if not found then
    raise exception 'Account not found';
  end if;

  -- Mirrors superadmin_delete_user: one operator never edits another.
  if target_role = 'superadmin' then
    raise exception 'Cannot change another superadmin account';
  end if;

  -- A church admin's role is tied to the church they created; demoting them
  -- here would leave that church with no one able to edit its songs.
  if target_church is not null then
    raise exception 'This account belongs to a church. Only church-less accounts can be encoders.';
  end if;

  update profiles set role = new_role where id = target_id;
end;
$$;

revoke all on function superadmin_set_role(uuid, text) from public, anon;
grant execute on function superadmin_set_role(uuid, text) to authenticated;

-- ============================================================================
-- 8. Library counts on the superadmin dashboard
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
    'total_library_songs', (select count(*) from hymn_templates where status = 'published')
  );
end;
$$;

-- ============================================================================
-- 9. HOW TO CREATE YOUR FIRST ENCODER  <-- read this
--
--   1. Have them sign up through the app as normal.
--   2. They verify their email.
--   3. STOP -- they must NOT complete onboarding. An encoder has no church,
--      and once an account owns a church it can no longer become one.
--   4. Sign in as superadmin, open /superadmin, find the account, and set its
--      role to Encoder.
--
-- They sign out and back in, and land on /encoder.
--
-- If the account has ALREADY completed onboarding, there is no supported fix --
-- superadmin_set_role rejects it on purpose. Have them sign up again with a
-- different email, and delete the stray account from /superadmin.
-- ============================================================================
