-- The pin map: turning the location answers we already collect into points.
--
-- Two questions have been banking free-text locations for a while now --
-- onboarding step 2 writes churches.location (0015) and the download survey
-- writes download_signups.church_location (0014) -- and until now nothing read
-- either. The landing page showed a screenshot of a map that had to be
-- re-exported by hand whenever it went stale. This migration replaces the
-- screenshot with the answers.
--
-- Design notes:
--
--  * Counts are DERIVED, never stored. There is no pins table with a
--    church_count column kept in step by triggers, because that column would
--    be wrong the first time a row was deleted, a location was corrected, or a
--    trigger was skipped by a bulk import -- and nothing would say so. The map
--    is a query over churches and download_signups, so "every onboarding and
--    every download lands on the map automatically" is not a promise made by a
--    trigger somebody has to maintain; it is the only behaviour available.
--
--  * Duplicates are impossible by construction, for the same reason. Ten
--    churches answering "Cebu City", "cebu city, philippines" and "Cebu"
--    normalise to places, and places are unique. There is nothing to
--    de-duplicate afterwards because nothing was ever inserted.
--
--  * Resolution is a gazetteer lookup, not a geocoding API. The alternative --
--    calling Nominatim or Google from a trigger or an edge function -- puts a
--    third-party network call in the path of somebody finishing onboarding,
--    needs a key and a budget, and rate-limits exactly when a lot of people
--    sign up at once. A table of provinces and countries answers the question
--    the pins can actually express, offline and instantly. It cannot place a
--    barangay, and it is not asked to: the pin says "a church in Cebu", which
--    is both true and as much as anyone should be publishing.
--
--  * The superadmin overrides everything. A location the matcher cannot read
--    is listed for review rather than silently dropped, an answer it reads
--    WRONGLY can be reassigned by hand, a bad pin can be hidden, and a place
--    that is not in the gazetteer at all can be added with its own
--    coordinates. See section 6.
--
--  * Nothing published identifies anybody. public_map_pins() returns a place,
--    a coordinate and two counts. Church names, account emails and the raw
--    location text never leave the database through it -- those are behind
--    is_superadmin(), same as the rest of the platform's admin surface.

-- ============================================================================
-- 1. Gazetteer
--
-- Every place a pin can land on. Seeded below with the world's countries and
-- with the Philippine provinces, which is where the overwhelming majority of
-- these churches are and the granularity people actually answer with.
-- ============================================================================

create table if not exists map_places (
  id uuid primary key default gen_random_uuid(),

  -- Stable, human-readable and unique, so the seed below can be re-run without
  -- inserting a second Cebu and so a bug report can name a row.
  slug text not null unique
    check (slug ~ '^[a-z0-9-]{2,64}$'),

  -- Display name, and implicitly the first alias: the matcher always tries
  -- normalize_location(name) before it looks at the aliases column. That is
  -- what keeps the seed for 234 countries down to a coordinate each.
  name text not null
    check (length(btrim(name)) between 2 and 80),

  --   country  - a whole nation, the fallback when nothing finer is named
  --   region   - an island group or similar, between a country and a province
  --   province - the level Filipino answers usually land on
  --   custom   - added by the superadmin for somewhere not seeded
  --
  -- The order matters: a more specific kind beats a less specific one when
  -- both match, which is why "Cebu City, Philippines" is a pin on Cebu and not
  -- one in the middle of Luzon. See match_map_place().
  kind text not null default 'custom'
    check (kind in ('country', 'region', 'province', 'custom')),

  -- ISO 3166-1 alpha-2. Used to stop a sub-national match in one country being
  -- picked for a location that plainly names another -- see match_map_place().
  country_code text
    check (country_code is null or country_code ~ '^[A-Z]{2}$'),

  lat double precision not null check (lat between -90 and 90),
  lng double precision not null check (lng between -180 and 180),

  -- Extra spellings, already normalised (lower case, no punctuation). Cities
  -- live here pointing at their province: nobody answers "Cebu" when they mean
  -- Mandaue, they answer "Mandaue".
  aliases text[] not null default '{}',

  --   seed   - shipped by this migration; shown only once something resolves
  --            to it, so the map is not 234 empty countries
  --   manual - added by the superadmin; always shown, because the only reason
  --            to add one by hand is to put it on the map
  source text not null default 'manual'
    check (source in ('seed', 'manual')),

  -- Kept off the public map without losing the resolution: locations that
  -- matched it still match it, they just stop being drawn. This is "remove
  -- this pin" without also meaning "and start counting these churches as
  -- unresolved".
  is_hidden boolean not null default false,

  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_map_places_kind on map_places (kind);
create index if not exists idx_map_places_country on map_places (country_code);

drop trigger if exists trg_map_places_updated_at on map_places;
create trigger trg_map_places_updated_at
  before update on map_places
  for each row execute function set_updated_at();

-- ============================================================================
-- 2. Overrides
--
-- One row per raw answer the superadmin has ruled on. Its presence beats the
-- matcher entirely:
--
--   place_id set   - "this text means THIS place", for an answer the matcher
--                    read wrongly or could not read at all
--   place_id null  - "keep this off the map", for a test row, a joke, or an
--                    answer too vague to place honestly
--
-- Keyed by the NORMALISED text, so one ruling covers "Cebu City",
-- "cebu city" and "Cebu  City,". Not a foreign key to anything: the same
-- string can arrive from onboarding and from the download survey, and both
-- should follow the ruling.
-- ============================================================================

create table if not exists map_location_assignments (
  location_key text primary key
    check (length(location_key) between 1 and 200),
  place_id uuid references map_places (id) on delete cascade,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_map_location_assignments_updated_at on map_location_assignments;
create trigger trg_map_location_assignments_updated_at
  before update on map_location_assignments
  for each row execute function set_updated_at();

-- ============================================================================
-- 3. Normalisation
--
-- Everything compared anywhere in this file goes through here first, so
-- "Cebu City", "cebu  city" and "Cebú City," are one key rather than three.
--
-- The translate() call folds the accents that actually turn up in these
-- answers -- Filipino place names carry ñ constantly (Dasmariñas, Biñan, Los
-- Baños) and Spanish-era spellings carry the rest. unaccent() would be
-- tidier but it is an extension, and requiring one to run a migration is a
-- deployment problem for a fifty-character translate().
--
-- Reducing everything else to single spaces is what lets the matcher use \m
-- and \M word boundaries without worrying about regex metacharacters: after
-- this, a key contains nothing but [a-z0-9 ].
-- ============================================================================

create or replace function normalize_location(raw text)
returns text
language sql
immutable
parallel safe
as $$
  select nullif(
    btrim(
      regexp_replace(
        regexp_replace(
          lower(
            translate(
              coalesce(raw, ''),
              'ÁÀÂÄÃÅáàâäãåÉÈÊËéèêëÍÌÎÏíìîïÓÒÔÖÕóòôöõÚÙÛÜúùûüÑñÇçÝý',
              'AAAAAAaaaaaaEEEEeeeeIIIIiiiiOOOOOoooooUUUUuuuuNnCcYy'
            )
          ),
          '[^a-z0-9]+', ' ', 'g'
        ),
        ' +', ' ', 'g'
      )
    ),
    ''
  );
$$;

-- ============================================================================
-- 4. The matcher
--
-- Given a normalised location, the place it belongs to -- or null.
--
-- Two passes, because one is demonstrably wrong. A single "best scoring match"
-- pass reads "Davao, Indonesia" as the Philippine province of Davao, since
-- province beats country and that is the end of it. So: find the country
-- first, then look for something finer INSIDE that country. A location that
-- names no country is free to match any province, which is what makes a bare
-- "Cebu City" work.
--
-- Within a pass the score is (specificity, then alias length). Alias length is
-- what makes "Quezon City" the capital region rather than Quezon province,
-- "Cagayan de Oro" a city in Misamis Oriental rather than Cagayan five hundred
-- miles north, and "Cotabato City" Maguindanao rather than Cotabato province.
-- Every one of those pairs is a real answer somebody has already given.
--
-- \m and \M are word boundaries: "cebu" matches "cebu city" but not
-- "cebuano", and -- the one that matters -- the country "Oman" does not match
-- a church in "Romana". Safe as a regex because normalize_location() has
-- already stripped everything that is not a letter, a digit or a space.
-- ============================================================================

create or replace function match_map_place(loc text)
returns uuid
language sql
stable
set search_path = public
as $$
  with key as (
    select normalize_location(loc) as k
  ),
  -- Name and aliases treated identically. The name is included here rather
  -- than duplicated into aliases so the seed cannot drift out of step with
  -- itself.
  candidates as (
    select
      p.id,
      p.kind,
      p.country_code,
      max(length(term)) as term_length
    from map_places p
    cross join lateral (
      select normalize_location(p.name) as term
      union all
      select a from unnest(p.aliases) as a
    ) terms
    cross join key
    where key.k is not null
      and term is not null
      -- Two characters is the floor because "UK", "US", "NZ" and "HK" are how
      -- people write those places, and a word-boundary match on a two-letter
      -- token is safe: "us" matches the answer "Ohio, US" and does not match
      -- "Jesus". A single character would match far too much.
      and length(term) >= 2
      -- Cheap test first. The pattern below is built per row, so Postgres
      -- compiles a fresh regex for every one of the ~900 terms in the
      -- gazetteer -- and for all but a handful the answer is obviously no.
      -- strpos() settles those without a regex engine, and only the few
      -- surviving substring hits pay for the word-boundary check that
      -- distinguishes "cebu" in "Cebu City" from "cebu" in "Cebuano".
      and strpos(key.k, term) > 0
      and key.k ~ ('\m' || term || '\M')
    group by p.id, p.kind, p.country_code
  ),
  -- Pass one: the nation.
  best_country as (
    select id, country_code
    from candidates
    where kind = 'country'
    order by term_length desc, id
    limit 1
  ),
  -- Pass two: anything finer, confined to that nation when one was named.
  best_local as (
    select c.id
    from candidates c
    where c.kind <> 'country'
      and (
        not exists (select 1 from best_country)
        or c.country_code is null
        or c.country_code = (select country_code from best_country)
      )
    order by
      case c.kind when 'custom' then 3 when 'province' then 2 else 1 end desc,
      c.term_length desc,
      c.id
    limit 1
  )
  select coalesce(
    (select id from best_local),
    (select id from best_country)
  );
$$;

-- ============================================================================
-- 5. Reading the map
--
-- map_pin_counts() is the shared half: every distinct answer we hold, resolved
-- to a place and counted. It is grouped by the normalised key BEFORE the
-- matcher runs, so the regex work is done once per distinct spelling rather
-- than once per church.
--
-- It is not granted to anyone. Both functions below are SECURITY DEFINER and
-- call it as the owner, which is the point: reading it directly would mean
-- reading churches and download_signups.
-- ============================================================================

create or replace function map_pin_counts()
returns table (place_id uuid, churches bigint, downloads bigint)
language sql
stable
set search_path = public
as $$
  with raw as (
    select 'church' as source, normalize_location(c.location) as key
    from churches c
    where c.location is not null
    union all
    select 'download', normalize_location(d.church_location)
    from download_signups d
    where d.church_location is not null
  ),
  keys as (
    select
      key,
      count(*) filter (where source = 'church') as churches,
      count(*) filter (where source = 'download') as downloads
    from raw
    where key is not null
    group by key
  ),
  resolved as (
    select
      -- A ruling wins outright, including a ruling of "nowhere": the
      -- case-expression collapses to null when an assignment row exists with a
      -- null place_id, so coalesce has nothing to fall back to. Without the
      -- case, "keep this off the map" would silently fall through to the
      -- matcher and put it straight back on.
      coalesce(
        a.place_id,
        case when a.location_key is null then match_map_place(k.key) end
      ) as place_id,
      k.churches,
      k.downloads
    from keys k
    left join map_location_assignments a on a.location_key = k.key
  )
  select place_id, sum(churches)::bigint, sum(downloads)::bigint
  from resolved
  where place_id is not null
  group by place_id;
$$;

-- Public, signed out. Places and counts only -- see the header note.
--
-- Seeded places appear once something resolves to them; hand-added ones appear
-- immediately, because adding one by hand is itself the decision to show it.
create or replace function public_map_pins()
returns table (
  slug text,
  name text,
  country_name text,
  kind text,
  lat double precision,
  lng double precision,
  churches bigint,
  downloads bigint
)
language sql
security definer
stable
set search_path = public
as $$
  select
    p.slug,
    p.name,
    coalesce(c.name, p.name),
    p.kind,
    p.lat,
    p.lng,
    coalesce(t.churches, 0),
    coalesce(t.downloads, 0)
  from map_places p
  left join map_pin_counts() t on t.place_id = p.id
  left join map_places c on c.kind = 'country' and c.country_code = p.country_code
  where not p.is_hidden
    and (p.source = 'manual' or t.place_id is not null)
  order by (coalesce(t.churches, 0) + coalesce(t.downloads, 0)) desc, p.name;
$$;

revoke all on function public_map_pins() from public;
grant execute on function public_map_pins() to anon, authenticated;

-- ============================================================================
-- 6. The superadmin's view of the same data
-- ============================================================================

-- Every pin the public map would draw, plus the hidden ones, so the operator
-- can see what they have suppressed and put it back.
create or replace function superadmin_map_pins()
returns table (
  id uuid,
  slug text,
  name text,
  country_name text,
  country_code text,
  kind text,
  source text,
  is_hidden boolean,
  lat double precision,
  lng double precision,
  aliases text[],
  churches bigint,
  downloads bigint
)
language plpgsql
security definer
stable
set search_path = public
as $$
begin
  if not is_superadmin() then
    raise exception 'Not authorised';
  end if;

  return query
  select
    p.id,
    p.slug,
    p.name,
    coalesce(c.name, p.name),
    p.country_code,
    p.kind,
    p.source,
    p.is_hidden,
    p.lat,
    p.lng,
    p.aliases,
    coalesce(t.churches, 0),
    coalesce(t.downloads, 0)
  from map_places p
  left join map_pin_counts() t on t.place_id = p.id
  left join map_places c on c.kind = 'country' and c.country_code = p.country_code
  where p.source = 'manual' or t.place_id is not null
  order by (coalesce(t.churches, 0) + coalesce(t.downloads, 0)) desc, p.name;
end;
$$;

-- The raw answers, and what became of each one.
--
-- This is the accuracy check the whole override mechanism exists for: it shows
-- the text people actually typed next to the place it was read as, so a wrong
-- reading is visible rather than merely being a pin in a slightly odd spot.
-- Unresolved rows sort to the top, because those are the ones nobody has dealt
-- with yet.
--
-- `sample` is one real answer per key, kept un-normalised so it reads the way
-- it was typed. It is church-identifying-ish, which is why this function is
-- behind is_superadmin() and public_map_pins() is not.
create or replace function superadmin_map_locations()
returns table (
  location_key text,
  sample text,
  churches bigint,
  downloads bigint,
  place_id uuid,
  place_name text,
  place_slug text,
  is_assigned boolean,
  is_ignored boolean
)
language plpgsql
security definer
stable
set search_path = public
as $$
begin
  if not is_superadmin() then
    raise exception 'Not authorised';
  end if;

  return query
  with raw as (
    select 'church' as source, c.location as text_value
    from churches c
    where c.location is not null
    union all
    select 'download', d.church_location
    from download_signups d
    where d.church_location is not null
  ),
  keys as (
    select
      normalize_location(r.text_value) as key,
      min(btrim(r.text_value)) as sample,
      count(*) filter (where r.source = 'church') as churches,
      count(*) filter (where r.source = 'download') as downloads
    from raw r
    where normalize_location(r.text_value) is not null
    group by normalize_location(r.text_value)
  )
  select
    k.key,
    k.sample,
    k.churches,
    k.downloads,
    coalesce(
      a.place_id,
      case when a.location_key is null then match_map_place(k.key) end
    ),
    p.name,
    p.slug,
    a.location_key is not null,
    a.location_key is not null and a.place_id is null
  from keys k
  left join map_location_assignments a on a.location_key = k.key
  left join map_places p on p.id = coalesce(
    a.place_id,
    case when a.location_key is null then match_map_place(k.key) end
  )
  order by (p.id is not null), (k.churches + k.downloads) desc, k.sample;
end;
$$;

revoke all on function superadmin_map_pins() from public, anon;
revoke all on function superadmin_map_locations() from public, anon;
grant execute on function superadmin_map_pins() to authenticated;
grant execute on function superadmin_map_locations() to authenticated;

-- normalize_location() and match_map_place() are internals. The functions
-- above are SECURITY DEFINER and call them as the owner, so nothing that
-- should work stops working -- this only takes away a way for a signed-out
-- visitor to enumerate the gazetteer.
revoke all on function normalize_location(text) from public, anon;
revoke all on function match_map_place(text) from public, anon;
revoke all on function map_pin_counts() from public, anon;
grant execute on function normalize_location(text) to authenticated;
grant execute on function match_map_place(text) to authenticated;

-- ============================================================================
-- 7. RLS
--
-- Both tables are superadmin-only, in every direction. The public map does not
-- read them directly -- public_map_pins() does, as the owner -- so there is no
-- reason to let anon near either.
-- ============================================================================

alter table map_places enable row level security;
alter table map_location_assignments enable row level security;

revoke all on table map_places from anon, authenticated;
revoke all on table map_location_assignments from anon, authenticated;
grant select, insert, update, delete on table map_places to authenticated;
grant select, insert, update, delete on table map_location_assignments to authenticated;

drop policy if exists "map_places_all_superadmin" on map_places;
create policy "map_places_all_superadmin" on map_places
  for all to authenticated
  using (is_superadmin())
  with check (is_superadmin());

drop policy if exists "map_location_assignments_all_superadmin" on map_location_assignments;
create policy "map_location_assignments_all_superadmin" on map_location_assignments
  for all to authenticated
  using (is_superadmin())
  with check (is_superadmin());

-- created_by is stamped server-side, for the same reason it is on churches
-- (0005) and platform_updates (0016): a column the client can write is a
-- column the client can forge.
create or replace function set_map_place_author()
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

drop trigger if exists trg_map_places_author on map_places;
create trigger trg_map_places_author
  before insert on map_places
  for each row execute function set_map_place_author();

drop trigger if exists trg_map_location_assignments_author on map_location_assignments;
create trigger trg_map_location_assignments_author
  before insert on map_location_assignments
  for each row execute function set_map_place_author();

-- ============================================================================
-- 8. Seed: countries
--
-- Generated by scripts/generate-world-map.mjs from Natural Earth 1:50m -- the
-- same source and the same projection as the outline the app draws, so a
-- country's pin is inside that country's shape by construction rather than by
-- coincidence. The coordinate is the centroid of the country's LARGEST
-- landmass, not of all its territory: an all-territory centroid puts the
-- United States in the Pacific and Norway in the Arctic.
--
-- `on conflict do nothing` keyed on slug, so re-running this migration cannot
-- duplicate a country or undo a superadmin's correction to one.
-- ============================================================================

insert into map_places (slug, name, kind, country_code, lat, lng, source)
select v.slug, v.name, 'country', v.code, v.lat, v.lng, 'seed'
from (values
  ('country-ad', 'Andorra', 'AD', 42.5421, 1.5607),
  ('country-ae', 'United Arab Emirates', 'AE', 23.9100, 54.3110),
  ('country-af', 'Afghanistan', 'AF', 33.9133, 66.0442),
  ('country-ag', 'Antigua and Barb.', 'AG', 17.0782, -61.7900),
  ('country-ai', 'Anguilla', 'AI', 18.2243, -63.0660),
  ('country-al', 'Albania', 'AL', 41.1548, 20.0487),
  ('country-am', 'Armenia', 'AM', 40.2973, 44.9250),
  ('country-ao', 'Angola', 'AO', -12.3890, 17.5667),
  ('country-ar', 'Argentina', 'AR', -36.3142, -65.3920),
  ('country-as', 'American Samoa', 'AS', -14.3046, -170.7180),
  ('country-at', 'Austria', 'AT', 47.5958, 14.1345),
  ('country-au', 'Australia', 'AU', -26.0229, 134.4431),
  ('country-aw', 'Aruba', 'AW', 12.5210, -69.9827),
  ('country-ax', 'Åland', 'AX', 60.2319, 19.9441),
  ('country-az', 'Azerbaijan', 'AZ', 40.3558, 47.6615),
  ('country-ba', 'Bosnia and Herz.', 'BA', 44.1840, 17.7656),
  ('country-bb', 'Barbados', 'BB', 13.1811, -59.5602),
  ('country-bd', 'Bangladesh', 'BD', 23.9142, 90.2196),
  ('country-be', 'Belgium', 'BE', 50.6456, 4.6356),
  ('country-bf', 'Burkina Faso', 'BF', 12.2776, -1.7512),
  ('country-bg', 'Bulgaria', 'BG', 42.7812, 25.2185),
  ('country-bh', 'Bahrain', 'BH', 26.0419, 50.5424),
  ('country-bi', 'Burundi', 'BI', -3.3599, 29.8752),
  ('country-bj', 'Benin', 'BJ', 9.6522, 2.3287),
  ('country-bl', 'St-Barthélemy', 'BL', 17.8988, -62.8410),
  ('country-bm', 'Bermuda', 'BM', 32.3132, -64.7557),
  ('country-bn', 'Brunei', 'BN', 4.4909, 114.5918),
  ('country-bo', 'Bolivia', 'BO', -16.7763, -64.6793),
  ('country-br', 'Brazil', 'BR', -11.2396, -53.0535),
  ('country-bs', 'Bahamas', 'BS', 24.7017, -78.0377),
  ('country-bt', 'Bhutan', 'BT', 27.4132, 90.4017),
  ('country-bw', 'Botswana', 'BW', -22.2322, 23.7931),
  ('country-by', 'Belarus', 'BY', 53.5782, 28.0415),
  ('country-bz', 'Belize', 'BZ', 17.1988, -88.7175),
  ('country-ca', 'Canada', 'CA', 59.7519, -104.1250),
  ('country-cd', 'Dem. Rep. Congo', 'CD', -2.9046, 23.6477),
  ('country-cf', 'Central African Rep.', 'CF', 6.5763, 20.4714),
  ('country-cg', 'Congo', 'CG', -0.8399, 15.2190),
  ('country-ch', 'Switzerland', 'CH', 46.8030, 8.2096),
  ('country-ci', 'Côte d''Ivoire', 'CI', 7.6365, -5.5698),
  ('country-ck', 'Cook Is.', 'CK', -21.2195, -159.7871),
  ('country-cl', 'Chile', 'CL', -37.9435, -71.4956),
  ('country-cm', 'Cameroon', 'CM', 5.7093, 12.7424),
  ('country-cn', 'China', 'CN', 37.6342, 104.1298),
  ('country-co', 'Colombia', 'CO', 3.9349, -73.0828),
  ('country-cr', 'Costa Rica', 'CR', 9.9785, -84.1934),
  ('country-cu', 'Cuba', 'CU', 21.6236, -78.9585),
  ('country-cv', 'Cabo Verde', 'CV', 15.0830, -23.6374),
  ('country-cw', 'Curaçao', 'CW', 12.1958, -68.9722),
  ('country-cy', 'Cyprus', 'CY', 34.9171, 33.0059),
  ('country-cz', 'Czechia', 'CZ', 49.7423, 15.3089),
  ('country-de', 'Germany', 'DE', 51.1986, 10.3823),
  ('country-dj', 'Djibouti', 'DJ', 11.7502, 42.5609),
  ('country-dk', 'Denmark', 'DK', 56.2579, 9.3601),
  ('country-dm', 'Dominica', 'DM', 15.4395, -61.3577),
  ('country-do', 'Dominican Rep.', 'DO', 18.8963, -70.5058),
  ('country-dz', 'Algeria', 'DZ', 28.4204, 2.6140),
  ('country-ec', 'Ecuador', 'EC', -1.4470, -78.3898),
  ('country-ee', 'Estonia', 'EE', 58.6967, 25.8293),
  ('country-eg', 'Egypt', 'EG', 26.5945, 29.8534),
  ('country-eh', 'W. Sahara', 'EH', 24.2739, -12.1932),
  ('country-er', 'Eritrea', 'ER', 15.3694, 38.8322),
  ('country-es', 'Spain', 'ES', 40.4822, -3.5595),
  ('country-et', 'Ethiopia', 'ET', 8.6529, 39.5960),
  ('country-fi', 'Finland', 'FI', 64.9150, 26.3180),
  ('country-fj', 'Fiji', 'FJ', -17.8234, 177.9729),
  ('country-fk', 'Falkland Is.', 'FK', -51.7465, -58.7620),
  ('country-fm', 'Micronesia', 'FM', 6.8865, 158.2323),
  ('country-fo', 'Faeroe Is.', 'FO', 62.1707, -6.8849),
  ('country-fr', 'France', 'FR', 46.7380, 2.4487),
  ('country-ga', 'Gabon', 'GA', -0.5871, 11.7883),
  ('country-gb', 'United Kingdom', 'GB', 54.1288, -2.5576),
  ('country-gd', 'Grenada', 'GD', 12.1174, -61.6818),
  ('country-ge', 'Georgia', 'GE', 42.1767, 43.4994),
  ('country-gg', 'Guernsey', 'GG', 49.4678, -2.5726),
  ('country-gh', 'Ghana', 'GH', 7.9638, -1.2167),
  ('country-gl', 'Greenland', 'GL', 77.3145, -41.1120),
  ('country-gm', 'Gambia', 'GM', 13.4499, -15.3954),
  ('country-gn', 'Guinea', 'GN', 10.4429, -10.9441),
  ('country-gq', 'Eq. Guinea', 'GQ', 1.5651, 10.4707),
  ('country-gr', 'Greece', 'GR', 39.5168, 22.5943),
  ('country-gs', 'S. Geo. and the Is.', 'GS', -54.3669, -36.6857),
  ('country-gt', 'Guatemala', 'GT', 15.7024, -90.3638),
  ('country-gu', 'Guam', 'GU', 13.4407, 144.7671),
  ('country-gw', 'Guinea-Bissau', 'GW', 12.0652, -14.9238),
  ('country-gy', 'Guyana', 'GY', 4.8010, -58.9829),
  ('country-hk', 'Hong Kong', 'HK', 22.4392, 114.1397),
  ('country-hm', 'Heard I. and McDonald Is.', 'HM', -53.0873, 73.5202),
  ('country-hn', 'Honduras', 'HN', 14.8264, -86.6148),
  ('country-hr', 'Croatia', 'HR', 45.1738, 16.4261),
  ('country-ht', 'Haiti', 'HT', 18.9309, -72.6751),
  ('country-hu', 'Hungary', 'HU', 47.1746, 19.4038),
  ('country-id', 'Indonesia', 'ID', -0.1908, 114.0147),
  ('country-ie', 'Ireland', 'IE', 53.2001, -8.1308),
  ('country-il', 'Israel', 'IL', 31.4771, 35.0065),
  ('country-im', 'Isle of Man', 'IM', 54.2244, -4.5383),
  ('country-in', 'India', 'IN', 23.2365, 79.6028),
  ('country-io', 'Br. Indian Ocean Ter.', 'IO', -7.3312, 72.4453),
  ('country-iq', 'Iraq', 'IQ', 33.1096, 43.7289),
  ('country-ir', 'Iran', 'IR', 32.7745, 54.1899),
  ('country-is', 'Iceland', 'IS', 65.0237, -18.5712),
  ('country-it', 'Italy', 'IT', 43.6426, 12.0752),
  ('country-je', 'Jersey', 'JE', 49.2181, -2.1272),
  ('country-jm', 'Jamaica', 'JM', 18.1569, -77.3152),
  ('country-jo', 'Jordan', 'JO', 31.2624, 36.7780),
  ('country-jp', 'Japan', 'JP', 36.7225, 138.0380),
  ('country-ke', 'Kenya', 'KE', 0.6018, 37.7953),
  ('country-kg', 'Kyrgyzstan', 'KG', 41.4792, 74.5483),
  ('country-kh', 'Cambodia', 'KH', 12.7267, 104.9085),
  ('country-ki', 'Kiribati', 'KI', 1.8536, -157.3744),
  ('country-km', 'Comoros', 'KM', -11.6543, 43.3391),
  ('country-kn', 'St. Kitts and Nevis', 'KN', 17.3267, -62.7472),
  ('country-kp', 'North Korea', 'KP', 40.1866, 127.2100),
  ('country-kr', 'South Korea', 'KR', 36.4800, 127.8723),
  ('country-kw', 'Kuwait', 'KW', 29.3191, 47.5618),
  ('country-ky', 'Cayman Is.', 'KY', 19.3207, -81.2856),
  ('country-kz', 'Kazakhstan', 'KZ', 48.4368, 67.3234),
  ('country-la', 'Laos', 'LA', 18.5392, 103.7195),
  ('country-lb', 'Lebanon', 'LB', 33.9256, 35.8817),
  ('country-lc', 'Saint Lucia', 'LC', 13.8946, -60.9696),
  ('country-li', 'Liechtenstein', 'LI', 47.1368, 9.5357),
  ('country-lk', 'Sri Lanka', 'LK', 7.6118, 80.7028),
  ('country-lr', 'Liberia', 'LR', 6.4557, -9.3232),
  ('country-ls', 'Lesotho', 'LS', -29.5832, 28.2264),
  ('country-lt', 'Lithuania', 'LT', 55.3400, 23.8870),
  ('country-lu', 'Luxembourg', 'LU', 49.7683, 6.0717),
  ('country-lv', 'Latvia', 'LV', 56.8607, 24.9083),
  ('country-ly', 'Libya', 'LY', 27.1562, 17.9804),
  ('country-ma', 'Morocco', 'MA', 30.0377, -8.3235),
  ('country-mc', 'Monaco', 'MC', 43.7526, 7.4073),
  ('country-md', 'Moldova', 'MD', 47.2093, 28.4527),
  ('country-me', 'Montenegro', 'ME', 42.7914, 19.2390),
  ('country-mf', 'St-Martin', 'MF', 18.0888, -63.0599),
  ('country-mg', 'Madagascar', 'MG', -19.4706, 46.6840),
  ('country-mh', 'Marshall Is.', 'MH', 7.1056, 171.1879),
  ('country-mk', 'Macedonia', 'MK', 41.5984, 21.6830),
  ('country-ml', 'Mali', 'ML', 17.4448, -3.5196),
  ('country-mm', 'Myanmar', 'MM', 21.3439, 96.4863),
  ('country-mn', 'Mongolia', 'MN', 46.9635, 103.0148),
  ('country-mo', 'Macao', 'MO', 22.2231, 113.5090),
  ('country-mp', 'N. Mariana Is.', 'MP', 15.1812, 145.7439),
  ('country-mr', 'Mauritania', 'MR', 20.3446, -10.3350),
  ('country-ms', 'Montserrat', 'MS', 16.7404, -62.1856),
  ('country-mt', 'Malta', 'MT', 35.8896, 14.4436),
  ('country-mu', 'Mauritius', 'MU', -20.2782, 57.5713),
  ('country-mv', 'Maldives', 'MV', 4.1970, 73.5031),
  ('country-mw', 'Malawi', 'MW', -13.2417, 34.2917),
  ('country-mx', 'Mexico', 'MX', 24.1833, -102.6841),
  ('country-my', 'Malaysia', 'MY', 3.6195, 114.7272),
  ('country-mz', 'Mozambique', 'MZ', -17.4128, 35.4982),
  ('country-na', 'Namibia', 'NA', -22.2454, 17.2172),
  ('country-nc', 'New Caledonia', 'NC', -21.3283, 165.4896),
  ('country-ne', 'Niger', 'NE', 17.4812, 9.4131),
  ('country-nf', 'Norfolk Island', 'NF', -29.0516, 167.9497),
  ('country-ng', 'Nigeria', 'NG', 9.6180, 8.0945),
  ('country-ni', 'Nicaragua', 'NI', 12.8530, -85.0298),
  ('country-nl', 'Netherlands', 'NL', 52.2948, 5.6469),
  ('country-no', 'Norway', 'NO', 65.1618, 14.9152),
  ('country-np', 'Nepal', 'NP', 28.2612, 83.9007),
  ('country-nr', 'Nauru', 'NR', -0.5189, 166.9326),
  ('country-nu', 'Niue', 'NU', -19.0489, -169.8704),
  ('country-nz', 'New Zealand', 'NZ', -44.0338, 170.4873),
  ('country-om', 'Oman', 'OM', 20.6161, 56.1002),
  ('country-pa', 'Panama', 'PA', 8.5256, -80.1123),
  ('country-pe', 'Peru', 'PE', -9.2371, -74.3630),
  ('country-pf', 'Fr. Polynesia', 'PF', -17.6641, -149.4196),
  ('country-pg', 'Papua New Guinea', 'PG', -6.6156, 144.2493),
  ('country-ph', 'Philippines', 'PH', 15.9742, 121.4133),
  ('country-pk', 'Pakistan', 'PK', 30.1212, 69.4280),
  ('country-pl', 'Poland', 'PL', 52.1910, 19.3759),
  ('country-pm', 'St. Pierre and Miquelon', 'PM', 46.9450, -56.3267),
  ('country-pn', 'Pitcairn Is.', 'PN', -24.3650, -128.3166),
  ('country-pr', 'Puerto Rico', 'PR', 18.2306, -66.4821),
  ('country-ps', 'Palestine', 'PS', 31.9496, 35.2478),
  ('country-pt', 'Portugal', 'PT', 39.7186, -7.9739),
  ('country-pw', 'Palau', 'PW', 7.5138, 134.5814),
  ('country-py', 'Paraguay', 'PY', -23.2775, -58.3782),
  ('country-qa', 'Qatar', 'QA', 25.3079, 51.1846),
  ('country-ro', 'Romania', 'RO', 45.8865, 24.9678),
  ('country-rs', 'Serbia', 'RS', 44.2434, 20.7808),
  ('country-ru', 'Russia', 'RU', 64.0502, 100.9001),
  ('country-rw', 'Rwanda', 'RW', -1.9904, 29.9198),
  ('country-sa', 'Saudi Arabia', 'SA', 24.2808, 44.4736),
  ('country-sb', 'Solomon Is.', 'SB', -9.6247, 160.1685),
  ('country-sc', 'Seychelles', 'SC', -4.6601, 55.4760),
  ('country-sd', 'Sudan', 'SD', 16.0779, 29.9566),
  ('country-se', 'Sweden', 'SE', 63.4440, 16.9881),
  ('country-sg', 'Singapore', 'SG', 1.3590, 103.8170),
  ('country-sh', 'Saint Helena', 'SH', -15.9589, -5.7168),
  ('country-si', 'Slovenia', 'SI', 46.1188, 14.8068),
  ('country-sk', 'Slovakia', 'SK', 48.7103, 19.4842),
  ('country-sl', 'Sierra Leone', 'SL', 8.5740, -11.7853),
  ('country-sm', 'San Marino', 'SM', 43.9415, 12.4594),
  ('country-sn', 'Senegal', 'SN', 14.3746, -14.4752),
  ('country-so', 'Somalia', 'SO', 4.7759, 45.7214),
  ('country-sr', 'Suriname', 'SR', 4.1327, -55.9124),
  ('country-ss', 'S. Sudan', 'SS', 7.3204, 30.2463),
  ('country-st', 'São Tomé and Principe', 'ST', 0.2382, 6.6059),
  ('country-sv', 'El Salvador', 'SV', 13.7397, -88.8723),
  ('country-sx', 'Sint Maarten', 'SX', 18.0509, -63.0572),
  ('country-sy', 'Syria', 'SY', 35.0499, 38.5177),
  ('country-sz', 'eSwatini', 'SZ', -26.5606, 31.4817),
  ('country-tc', 'Turks and Caicos Is.', 'TC', 21.8114, -71.7405),
  ('country-td', 'Chad', 'TD', 15.4404, 18.6496),
  ('country-tf', 'Fr. S. Antarctic Lands', 'TF', -49.3056, 69.4960),
  ('country-tg', 'Togo', 'TG', 8.5322, 0.9619),
  ('country-th', 'Thailand', 'TH', 15.2024, 101.0074),
  ('country-tj', 'Tajikistan', 'TJ', 38.5443, 71.0075),
  ('country-tl', 'Timor-Leste', 'TL', -8.8099, 125.9232),
  ('country-tm', 'Turkmenistan', 'TM', 39.1697, 59.3353),
  ('country-tn', 'Tunisia', 'TN', 34.1706, 9.5463),
  ('country-to', 'Tonga', 'TO', -21.1666, -175.2165),
  ('country-tr', 'Turkey', 'TR', 39.0303, 35.4279),
  ('country-tt', 'Trinidad and Tobago', 'TT', 10.4212, -61.2929),
  ('country-tw', 'Taiwan', 'TW', 23.7580, 120.9632),
  ('country-tz', 'Tanzania', 'TZ', -6.2973, 34.8041),
  ('country-ua', 'Ukraine', 'UA', 49.2259, 31.2216),
  ('country-ug', 'Uganda', 'UG', 1.2757, 32.3697),
  ('country-us', 'United States of America', 'US', 40.1366, -99.3134),
  ('country-uy', 'Uruguay', 'UY', -32.8215, -56.0146),
  ('country-uz', 'Uzbekistan', 'UZ', 41.8348, 63.0507),
  ('country-va', 'Vatican', 'VA', 41.9021, 12.4343),
  ('country-vc', 'St. Vin. and Gren.', 'VC', 13.2542, -61.1952),
  ('country-ve', 'Venezuela', 'VE', 7.1374, -66.1926),
  ('country-vg', 'British Virgin Is.', 'VG', 18.4225, -64.6219),
  ('country-vi', 'U.S. Virgin Is.', 'VI', 17.7412, -64.7721),
  ('country-vn', 'Vietnam', 'VN', 16.8141, 106.2769),
  ('country-vu', 'Vanuatu', 'VU', -15.2264, 166.8495),
  ('country-wf', 'Wallis and Futuna Is.', 'WF', -14.2862, -178.1303),
  ('country-ws', 'Samoa', 'WS', -13.6311, -172.4368),
  ('country-ye', 'Yemen', 'YE', 15.9505, 47.5508),
  ('country-za', 'South Africa', 'ZA', -29.1313, 25.1036),
  ('country-zm', 'Zambia', 'ZM', -13.4908, 27.7581),
  ('country-zw', 'Zimbabwe', 'ZW', -19.0272, 29.8516)
) as v(slug, name, code, lat, lng)
on conflict (slug) do nothing;

-- Countries people write the short way, or the old way, or the way their
-- passport does not. Applied as an update so the generated block above stays
-- purely mechanical.
update map_places set aliases = v.aliases
from (values
  ('country-us', array['usa', 'us', 'america', 'united states', 'u s a']),
  ('country-gb', array['uk', 'britain', 'great britain', 'england', 'scotland', 'wales', 'northern ireland']),
  ('country-ae', array['uae', 'emirates', 'u a e', 'dubai', 'abu dhabi', 'sharjah', 'ajman']),
  ('country-kr', array['south korea', 'korea', 'seoul', 'republic of korea']),
  ('country-kp', array['north korea']),
  ('country-cn', array['china', 'prc', 'beijing', 'shanghai', 'guangzhou', 'shenzhen']),
  ('country-hk', array['hong kong', 'hongkong', 'hk']),
  ('country-tw', array['taiwan', 'taipei', 'republic of china']),
  ('country-jp', array['japan', 'tokyo', 'osaka', 'nagoya', 'yokohama']),
  ('country-sg', array['singapore', 'sg']),
  ('country-my', array['malaysia', 'kuala lumpur', 'sabah', 'sarawak', 'kl']),
  ('country-id', array['indonesia', 'jakarta', 'bali', 'surabaya']),
  ('country-vn', array['vietnam', 'viet nam', 'hanoi', 'ho chi minh']),
  ('country-th', array['thailand', 'bangkok', 'chiang mai']),
  ('country-mm', array['myanmar', 'burma', 'yangon']),
  ('country-kh', array['cambodia', 'phnom penh']),
  ('country-la', array['laos', 'vientiane']),
  ('country-bd', array['bangladesh', 'dhaka', 'chittagong']),
  ('country-in', array['india', 'bharat', 'delhi', 'new delhi', 'mumbai', 'chennai', 'bangalore', 'bengaluru', 'kolkata', 'hyderabad']),
  ('country-pk', array['pakistan', 'karachi', 'lahore', 'islamabad']),
  ('country-lk', array['sri lanka', 'ceylon', 'colombo']),
  ('country-np', array['nepal', 'kathmandu']),
  ('country-sa', array['saudi', 'saudi arabia', 'ksa', 'riyadh', 'jeddah', 'dammam']),
  ('country-qa', array['qatar', 'doha']),
  ('country-kw', array['kuwait']),
  ('country-bh', array['bahrain', 'manama']),
  ('country-om', array['oman', 'muscat']),
  ('country-il', array['israel', 'jerusalem', 'tel aviv']),
  ('country-au', array['australia', 'sydney', 'melbourne', 'brisbane', 'perth', 'aussie']),
  ('country-nz', array['new zealand', 'auckland', 'wellington', 'nz']),
  ('country-ca', array['canada', 'toronto', 'vancouver', 'calgary', 'ottawa', 'montreal']),
  ('country-mx', array['mexico', 'mexico city']),
  ('country-br', array['brazil', 'brasil', 'sao paulo', 'rio de janeiro']),
  ('country-za', array['south africa', 'johannesburg', 'cape town', 'pretoria', 'durban']),
  ('country-ng', array['nigeria', 'lagos', 'abuja']),
  ('country-ke', array['kenya', 'nairobi', 'mombasa']),
  ('country-ug', array['uganda', 'kampala']),
  ('country-tz', array['tanzania', 'dar es salaam']),
  ('country-gh', array['ghana', 'accra']),
  ('country-eg', array['egypt', 'cairo']),
  ('country-de', array['germany', 'deutschland', 'berlin', 'munich', 'frankfurt']),
  ('country-nl', array['netherlands', 'holland', 'amsterdam', 'rotterdam']),
  ('country-es', array['spain', 'espana', 'madrid', 'barcelona']),
  ('country-it', array['italy', 'italia', 'rome', 'roma', 'milan']),
  ('country-fr', array['france', 'paris']),
  ('country-ch', array['switzerland', 'zurich', 'geneva']),
  ('country-at', array['austria', 'vienna']),
  ('country-be', array['belgium', 'brussels']),
  ('country-se', array['sweden', 'stockholm']),
  ('country-no', array['norway', 'oslo']),
  ('country-dk', array['denmark', 'copenhagen']),
  ('country-fi', array['finland', 'helsinki']),
  ('country-ie', array['ireland', 'dublin']),
  ('country-pl', array['poland', 'warsaw']),
  ('country-pt', array['portugal', 'lisbon']),
  ('country-gr', array['greece', 'athens']),
  ('country-ru', array['russia', 'moscow', 'russian federation']),
  ('country-tr', array['turkey', 'turkiye', 'istanbul', 'ankara']),
  ('country-pg', array['papua new guinea', 'port moresby']),
  ('country-gu', array['guam', 'hagatna']),
  ('country-fj', array['fiji', 'suva'])
) as v(slug, aliases)
where map_places.slug = v.slug;

-- ============================================================================
-- 9. Seed: the Philippines, properly
--
-- Every province, plus the capital region and the three chartered cities big
-- enough that people name them instead of a province. This is the half of the
-- gazetteer that earns its keep -- almost every answer either of the two forms
-- has collected is a Philippine city or province, and without this block they
-- would all pile onto a single pin in the middle of Luzon.
--
-- The alias lists are cities pointing at the province that contains them, and
-- they are not decoration: the answer is far more often "Bacolod" or "Tagum"
-- or "Gensan" than it is the province those are in.
--
-- Watch for the collisions when editing, because several are real and the
-- longest-alias rule is the only thing resolving them:
--
--   Quezon City       -> Metro Manila,       not Quezon province
--   Cagayan de Oro    -> Misamis Oriental,   not Cagayan (600 km north)
--   Cotabato City     -> Maguindanao,        not Cotabato province
--   Isabela City      -> Basilan,            not Isabela province
--   South Cotabato    -> its own province,   not Cotabato
--   Davao / Davao City-> Davao City,         not Davao del Sur
--
-- Coordinates are province centroids, near enough for a pin at this zoom.
-- ============================================================================

insert into map_places (slug, name, kind, country_code, lat, lng, aliases, source)
select v.slug, v.name, v.kind, 'PH', v.lat, v.lng, v.aliases, 'seed'
from (values
  -- Island groups, for answers that name no province at all.
  ('ph-luzon', 'Luzon', 'region', 16.00, 121.00, array[]::text[]),
  ('ph-visayas', 'Visayas', 'region', 11.00, 123.50, array['visayan']),
  ('ph-mindanao', 'Mindanao', 'region', 7.80, 125.00, array[]::text[]),

  -- National Capital Region
  ('ph-metro-manila', 'Metro Manila', 'province', 14.60, 121.00, array[
    'manila', 'ncr', 'national capital region', 'quezon city', 'makati',
    'taguig', 'pasig', 'caloocan', 'paranaque', 'las pinas', 'muntinlupa',
    'mandaluyong', 'san juan city', 'pasay', 'marikina', 'valenzuela',
    'malabon', 'navotas', 'pateros', 'bonifacio global city', 'ortigas',
    'cubao', 'alabang']),

  -- Ilocos Region
  ('ph-ilocos-norte', 'Ilocos Norte', 'province', 18.16, 120.75, array['laoag', 'batac', 'pagudpud']),
  ('ph-ilocos-sur', 'Ilocos Sur', 'province', 17.22, 120.55, array['vigan', 'candon']),
  ('ph-la-union', 'La Union', 'province', 16.62, 120.37, array['san fernando la union', 'agoo', 'bauang']),
  ('ph-pangasinan', 'Pangasinan', 'province', 15.92, 120.36, array['dagupan', 'urdaneta', 'alaminos', 'lingayen', 'san carlos city']),

  -- Cordillera
  ('ph-abra', 'Abra', 'province', 17.60, 120.80, array['bangued']),
  ('ph-apayao', 'Apayao', 'province', 18.01, 121.17, array['kabugao']),
  ('ph-benguet', 'Benguet', 'province', 16.55, 120.75, array['baguio', 'la trinidad']),
  ('ph-ifugao', 'Ifugao', 'province', 16.83, 121.17, array['lagawe', 'banaue']),
  ('ph-kalinga', 'Kalinga', 'province', 17.47, 121.36, array['tabuk']),
  ('ph-mountain-province', 'Mountain Province', 'province', 17.08, 121.02, array['bontoc', 'sagada']),

  -- Cagayan Valley
  ('ph-batanes', 'Batanes', 'province', 20.45, 121.97, array['basco']),
  ('ph-cagayan', 'Cagayan', 'province', 18.05, 121.75, array['tuguegarao', 'aparri']),
  ('ph-isabela', 'Isabela', 'province', 16.97, 121.80, array['ilagan', 'santiago city', 'cauayan']),
  ('ph-nueva-vizcaya', 'Nueva Vizcaya', 'province', 16.33, 121.15, array['bayombong', 'solano']),
  ('ph-quirino', 'Quirino', 'province', 16.27, 121.60, array['cabarroguis']),

  -- Central Luzon
  ('ph-aurora', 'Aurora', 'province', 15.75, 121.55, array['baler']),
  ('ph-bataan', 'Bataan', 'province', 14.65, 120.47, array['balanga', 'mariveles']),
  ('ph-bulacan', 'Bulacan', 'province', 14.85, 120.90, array['malolos', 'meycauayan', 'san jose del monte', 'baliuag']),
  ('ph-nueva-ecija', 'Nueva Ecija', 'province', 15.58, 121.00, array['cabanatuan', 'palayan', 'gapan', 'san jose city']),
  ('ph-pampanga', 'Pampanga', 'province', 15.08, 120.65, array['angeles city', 'mabalacat', 'san fernando pampanga', 'clark']),
  ('ph-tarlac', 'Tarlac', 'province', 15.48, 120.60, array['tarlac city', 'concepcion tarlac']),
  ('ph-zambales', 'Zambales', 'province', 15.50, 120.10, array['olongapo', 'iba', 'subic']),

  -- Calabarzon
  ('ph-batangas', 'Batangas', 'province', 13.85, 121.05, array['batangas city', 'lipa', 'tanauan', 'nasugbu', 'lemery']),
  ('ph-cavite', 'Cavite', 'province', 14.28, 120.88, array['dasmarinas', 'bacoor', 'imus', 'tagaytay', 'general trias', 'silang', 'trece martires']),
  ('ph-laguna', 'Laguna', 'province', 14.20, 121.35, array['calamba', 'santa rosa', 'san pablo', 'binan', 'cabuyao', 'los banos', 'sta rosa']),
  ('ph-quezon', 'Quezon', 'province', 14.00, 122.10, array['lucena', 'tayabas', 'quezon province', 'sariaya']),
  ('ph-rizal', 'Rizal', 'province', 14.60, 121.25, array['antipolo', 'cainta', 'taytay', 'binangonan', 'rodriguez', 'san mateo rizal']),

  -- Mimaropa
  ('ph-marinduque', 'Marinduque', 'province', 13.40, 121.98, array['boac']),
  ('ph-occidental-mindoro', 'Occidental Mindoro', 'province', 12.90, 120.90, array['mamburao', 'san jose mindoro']),
  ('ph-oriental-mindoro', 'Oriental Mindoro', 'province', 13.05, 121.25, array['calapan', 'puerto galera']),
  ('ph-palawan', 'Palawan', 'province', 9.85, 118.75, array['puerto princesa', 'el nido', 'coron', 'brookes point']),
  ('ph-romblon', 'Romblon', 'province', 12.55, 122.27, array['odiongan']),

  -- Bicol
  ('ph-albay', 'Albay', 'province', 13.20, 123.65, array['legazpi', 'tabaco', 'ligao', 'daraga']),
  ('ph-camarines-norte', 'Camarines Norte', 'province', 14.14, 122.76, array['daet']),
  ('ph-camarines-sur', 'Camarines Sur', 'province', 13.62, 123.20, array['naga city', 'iriga', 'pili']),
  ('ph-catanduanes', 'Catanduanes', 'province', 13.71, 124.24, array['virac']),
  ('ph-masbate', 'Masbate', 'province', 12.35, 123.55, array['masbate city']),
  ('ph-sorsogon', 'Sorsogon', 'province', 12.90, 124.00, array['sorsogon city', 'bulan', 'gubat']),

  -- Western Visayas
  ('ph-aklan', 'Aklan', 'province', 11.70, 122.32, array['kalibo', 'boracay', 'malay aklan']),
  ('ph-antique', 'Antique', 'province', 11.20, 122.10, array['san jose de buenavista']),
  ('ph-capiz', 'Capiz', 'province', 11.45, 122.75, array['roxas city']),
  ('ph-guimaras', 'Guimaras', 'province', 10.58, 122.62, array['jordan guimaras']),
  ('ph-iloilo', 'Iloilo', 'province', 10.90, 122.55, array['iloilo city', 'passi', 'oton']),
  ('ph-negros-occidental', 'Negros Occidental', 'province', 10.40, 123.05, array['bacolod', 'silay', 'cadiz', 'sagay', 'kabankalan', 'talisay negros', 'victorias']),

  -- Central Visayas
  ('ph-bohol', 'Bohol', 'province', 9.85, 124.15, array['tagbilaran', 'panglao', 'ubay']),
  ('ph-cebu', 'Cebu', 'province', 10.32, 123.90, array['cebu city', 'mandaue', 'lapu lapu', 'lapulapu', 'consolacion', 'minglanilla', 'toledo city', 'danao city', 'carcar', 'bogo city', 'liloan']),
  ('ph-negros-oriental', 'Negros Oriental', 'province', 9.65, 123.05, array['dumaguete', 'bais', 'tanjay', 'bayawan']),
  ('ph-siquijor', 'Siquijor', 'province', 9.20, 123.58, array[]::text[]),

  -- Eastern Visayas
  ('ph-biliran', 'Biliran', 'province', 11.58, 124.47, array['naval biliran']),
  ('ph-eastern-samar', 'Eastern Samar', 'province', 11.60, 125.40, array['borongan', 'guiuan']),
  ('ph-leyte', 'Leyte', 'province', 10.90, 124.85, array['tacloban', 'ormoc', 'baybay', 'palo leyte']),
  ('ph-northern-samar', 'Northern Samar', 'province', 12.35, 124.65, array['catarman']),
  ('ph-samar', 'Samar', 'province', 11.90, 125.00, array['western samar', 'catbalogan', 'calbayog']),
  ('ph-southern-leyte', 'Southern Leyte', 'province', 10.35, 125.10, array['maasin']),

  -- Zamboanga Peninsula
  ('ph-zamboanga-city', 'Zamboanga City', 'province', 6.92, 122.08, array['zamboanga']),
  ('ph-zamboanga-del-norte', 'Zamboanga del Norte', 'province', 8.30, 123.10, array['dipolog', 'dapitan']),
  ('ph-zamboanga-del-sur', 'Zamboanga del Sur', 'province', 7.85, 123.35, array['pagadian']),
  ('ph-zamboanga-sibugay', 'Zamboanga Sibugay', 'province', 7.70, 122.70, array['ipil']),

  -- Northern Mindanao
  ('ph-bukidnon', 'Bukidnon', 'province', 8.05, 125.10, array['malaybalay', 'valencia city']),
  ('ph-camiguin', 'Camiguin', 'province', 9.17, 124.73, array['mambajao']),
  ('ph-lanao-del-norte', 'Lanao del Norte', 'province', 8.00, 123.90, array['iligan', 'tubod lanao']),
  ('ph-misamis-occidental', 'Misamis Occidental', 'province', 8.35, 123.70, array['oroquieta', 'ozamiz', 'tangub']),
  ('ph-misamis-oriental', 'Misamis Oriental', 'province', 8.55, 124.75, array['cagayan de oro', 'cdo', 'gingoog']),

  -- Davao Region
  ('ph-davao-city', 'Davao City', 'province', 7.07, 125.61, array['davao']),
  ('ph-davao-de-oro', 'Davao de Oro', 'province', 7.50, 126.05, array['compostela valley', 'nabunturan']),
  ('ph-davao-del-norte', 'Davao del Norte', 'province', 7.55, 125.75, array['tagum', 'panabo', 'samal island']),
  ('ph-davao-del-sur', 'Davao del Sur', 'province', 6.75, 125.35, array['digos']),
  ('ph-davao-occidental', 'Davao Occidental', 'province', 6.10, 125.65, array['malita']),
  ('ph-davao-oriental', 'Davao Oriental', 'province', 7.05, 126.30, array['mati']),

  -- Soccsksargen
  ('ph-cotabato', 'Cotabato', 'province', 7.20, 124.85, array['north cotabato', 'kidapawan']),
  ('ph-sarangani', 'Sarangani', 'province', 5.95, 125.20, array['alabel', 'glan']),
  ('ph-south-cotabato', 'South Cotabato', 'province', 6.30, 124.85, array['koronadal', 'general santos', 'gensan', 'polomolok']),
  ('ph-sultan-kudarat', 'Sultan Kudarat', 'province', 6.55, 124.55, array['isulan', 'tacurong']),

  -- Caraga
  ('ph-agusan-del-norte', 'Agusan del Norte', 'province', 9.05, 125.55, array['butuan', 'cabadbaran']),
  ('ph-agusan-del-sur', 'Agusan del Sur', 'province', 8.45, 125.90, array['bayugan', 'prosperidad']),
  ('ph-dinagat-islands', 'Dinagat Islands', 'province', 10.13, 125.61, array['dinagat']),
  ('ph-surigao-del-norte', 'Surigao del Norte', 'province', 9.65, 125.60, array['surigao city', 'siargao']),
  ('ph-surigao-del-sur', 'Surigao del Sur', 'province', 8.75, 126.15, array['tandag', 'bislig']),

  -- Bangsamoro
  ('ph-basilan', 'Basilan', 'province', 6.55, 122.05, array['isabela city', 'lamitan']),
  ('ph-lanao-del-sur', 'Lanao del Sur', 'province', 7.85, 124.25, array['marawi']),
  ('ph-maguindanao', 'Maguindanao', 'province', 7.05, 124.35, array['cotabato city', 'maguindanao del norte', 'maguindanao del sur', 'buluan', 'datu odin sinsuat']),
  ('ph-sulu', 'Sulu', 'province', 5.98, 121.05, array['jolo']),
  ('ph-tawi-tawi', 'Tawi-Tawi', 'province', 5.10, 119.90, array['bongao', 'tawi tawi'])
) as v(slug, name, kind, lat, lng, aliases)
on conflict (slug) do nothing;
