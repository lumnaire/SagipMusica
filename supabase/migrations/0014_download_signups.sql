-- Download survey: who is installing the desktop app, and where they worship.
--
-- The download page now asks two questions before handing over the installer --
-- church name and location -- so we know which congregations are actually
-- running SagipMusica. Answers land here.
--
-- Design notes:
--
--  * This table is written by people who are NOT signed in. The download page
--    is public and the desktop app has no accounts at all, so the insert comes
--    from the browser under the `anon` key. That makes it the only
--    anon-writable table in the schema, and it is shaped accordingly: insert
--    is the ONLY privilege anon holds, the row is validated by check
--    constraints rather than by trusting the client, and nothing in it can be
--    read back.
--
--  * Not everyone downloading belongs to a church. Pastors evaluating it for a
--    congregation they have not joined yet, students, and the plainly curious
--    all get a way through -- see signup_type below. Their row is recorded as a
--    visitor rather than being dropped: "how many downloads came from outside a
--    church" is itself worth knowing, and the alternative is a required field
--    people invent an answer for, which poisons the church numbers.
--
--  * It is deliberately NOT linked to churches or profiles. A church filling
--    this in has usually never signed up for the web app, and forcing a match
--    would either drop the answer or create a half-real church row. This is a
--    survey response, not a tenant.
--
--  * Because anon can insert, this endpoint can be flooded -- the only thing
--    stopping a script is Supabase's own rate limiting. That is an acceptable
--    trade for a survey nobody has to log in to answer; the constraints below
--    at least keep the junk small and readable. If it does get abused, the
--    move is a captcha on the form, not a policy change here.
--
--  * No unique constraint on church_name. The same church downloading again on
--    a second computer is a real, useful signal, and duplicate rows are far
--    cheaper than an insert that fails and blocks somebody's download.

-- ============================================================================
-- 1. Table
-- ============================================================================

create table if not exists download_signups (
  id uuid primary key default gen_random_uuid(),

  --   church   - answered both questions
  --   visitor  - chose "I'm not with a church", answered neither
  signup_type text not null default 'church'
    check (signup_type in ('church', 'visitor')),

  -- Nullable because a visitor has nothing to put here. Trimmed and
  -- length-capped in the database, not just in the form: a check constraint is
  -- the only validation that survives a request built by hand.
  church_name text
    check (church_name is null or length(btrim(church_name)) between 2 and 120),
  church_location text
    check (church_location is null or length(btrim(church_location)) between 2 and 160),

  -- Which build they were handed, so a download in six months is not counted
  -- against whatever version happens to be current when we read the table.
  app_version text not null default 'unknown'
    check (length(app_version) <= 32),

  -- Windows is the only installer today; macOS is on the way and will want
  -- telling apart from it here.
  platform text not null default 'windows'
    check (platform in ('windows', 'macos', 'linux')),

  created_at timestamptz not null default now(),

  -- The answers and the type have to agree. Without this a crafted request
  -- could file a named church as a visitor (hiding it from the church counts)
  -- or a visitor row carrying somebody's church name, and neither number could
  -- be trusted afterwards.
  constraint download_signups_answers_match_type check (
    case signup_type
      when 'church' then church_name is not null and church_location is not null
      else church_name is null and church_location is null
    end
  )
);

create index if not exists idx_download_signups_created_at
  on download_signups (created_at desc);

-- ============================================================================
-- 2. RLS
--
-- Insert-only for the public, readable by the superadmin. Note that a policy
-- is used for the read rather than the SECURITY DEFINER function 0011 favours:
-- that note was about widening EXISTING policies on shared tables, and this
-- table starts with none -- there is no other query whose visibility could
-- change.
-- ============================================================================

alter table download_signups enable row level security;

-- Supabase grants ALL on new public tables to anon and authenticated by
-- default. Take it back and hand out exactly what each role needs.
revoke all on table download_signups from anon, authenticated;
grant insert on table download_signups to anon, authenticated;
grant select on table download_signups to authenticated;

drop policy if exists "download_signups_insert_public" on download_signups;
create policy "download_signups_insert_public" on download_signups
  for insert to anon, authenticated
  with check (true);

drop policy if exists "download_signups_select_superadmin" on download_signups;
create policy "download_signups_select_superadmin" on download_signups
  for select to authenticated
  using (is_superadmin());

-- ============================================================================
-- 3. Reading the answers
--
-- One row per church, newest download first, with a count of how many times
-- that church has downloaded. Every visitor collapses into a single row with
-- null answers and the running total beside it. Superadmin-gated the same way
-- as the rest of 0011's functions -- EXECUTE is granted to `authenticated`,
-- and the check inside is the real gate.
-- ============================================================================

-- Dropped rather than replaced: `create or replace` cannot change a function's
-- OUT parameters, so once this has been run and the returned columns change,
-- every later run fails with 42P13 until the old one is gone.
drop function if exists superadmin_download_signups();

create function superadmin_download_signups()
returns table (
  signup_type text,
  church_name text,
  church_location text,
  downloads bigint,
  first_download timestamptz,
  last_download timestamptz
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
    d.signup_type,
    btrim(d.church_name),
    btrim(d.church_location),
    count(*),
    min(d.created_at),
    max(d.created_at)
  from download_signups d
  group by d.signup_type, btrim(d.church_name), btrim(d.church_location)
  order by max(d.created_at) desc;
end;
$$;

revoke all on function superadmin_download_signups() from public, anon;
grant execute on function superadmin_download_signups() to authenticated;
