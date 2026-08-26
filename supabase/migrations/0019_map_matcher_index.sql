-- Makes the pin matcher usable, and gives unreadable answers a home.
--
-- 0018 shipped a matcher that could not survive contact with real data. It
-- asked, for every location anyone had ever typed: "for each of the ~320 places
-- in the gazetteer, normalise its name, expand its aliases, and test all of
-- them against this string with a regular expression." That is roughly a
-- thousand regex compilations and three hundred normalisations PER DISTINCT
-- ANSWER, and it scales with the product of the two. Measured on 2,000 churches
-- and 1,500 downloads sharing 300 distinct spellings, public_map_pins() took
-- 23 seconds. Supabase cancels a statement at 8, so the landing page and the
-- superadmin dashboard both got a 500 and the console filled with 57014.
--
-- The fix is not a faster loop, it is the other direction entirely.
--
--   0018: take each of ~1,000 gazetteer terms and ask "is it in this answer?"
--   0019: take the answer, cut it into the ~40 word-sequences it contains, and
--         look each one up in an index.
--
-- Every term is normalised ONCE, when the place is saved, into map_place_terms.
-- Matching is then an indexed equality join, and word-boundary correctness --
-- which the regex existed to provide -- comes free: an n-gram is a whole
-- sequence of whole words, so "cebu" can match "cebu city" and cannot match
-- "cebuano" because "cebuano" is one word and never yields the gram "cebu".
--
-- Behaviour is unchanged. Same two passes, same longest-alias-wins tie-break,
-- same results for every case in scripts/check-map-migration.mjs.

-- ============================================================================
-- 1. The lookup table
--
-- One row per (searchable term, place). Written only by the trigger below, so
-- it cannot drift from map_places: there is no path that edits a name or an
-- alias without rebuilding that place's terms in the same statement.
-- ============================================================================

create table if not exists map_place_terms (
  term text not null,
  place_id uuid not null references map_places (id) on delete cascade,
  -- How many words the term is. The matcher needs the longest term in the
  -- table to know how wide an n-gram is worth generating; without it the
  -- limit would be a magic number that silently stops matching the day
  -- somebody adds "Saint Vincent and the Grenadines".
  word_count int not null,
  primary key (term, place_id)
);

-- The index the whole rewrite exists for.
create index if not exists idx_map_place_terms_term on map_place_terms (term);

-- ============================================================================
-- 2. Keeping it in step with map_places
-- ============================================================================

-- plpgsql, with the DELETE and the INSERT as SEPARATE STATEMENTS. This is not
-- a style choice, it is the whole correctness of the function.
--
-- Written the obvious way -- `with removed as (delete ...) insert ... on
-- conflict do nothing` -- it silently destroys the index. Every CTE in one
-- statement sees the same snapshot, so the INSERT cannot see the DELETE: every
-- term that already existed still looks present, hits the conflict, is skipped
-- by `do nothing`, and is then removed by the delete anyway. What survives is
-- exactly the terms that were NEW. Re-indexing the United States that way left
-- it with one search term out of six, and nothing anywhere reported an error.
--
-- Two statements in plpgsql each get their own command id, so the insert sees
-- the delete and re-inserts everything.
create or replace function rebuild_map_place_terms(target uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from map_place_terms where place_id = target;

  -- The name is a search term in its own right, which is what keeps the seed
  -- for 234 countries down to a coordinate each. Blank and one-letter terms
  -- are dropped: a single character would match almost every answer.
  insert into map_place_terms (term, place_id, word_count)
  select distinct t.term, p.id, cardinality(string_to_array(t.term, ' '))
  from map_places p
  cross join lateral (
    select normalize_location(p.name) as term
    union all
    select normalize_location(a) from unnest(p.aliases) as a
  ) t
  where p.id = target
    and t.term is not null
    and length(t.term) >= 2
  on conflict (term, place_id) do nothing;
end;
$$;

create or replace function sync_map_place_terms()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform rebuild_map_place_terms(new.id);
  return new;
end;
$$;

drop trigger if exists trg_map_places_terms on map_places;
create trigger trg_map_places_terms
  after insert or update of name, aliases on map_places
  for each row execute function sync_map_place_terms();

-- The backfill is at the END of this migration, after section 6 has finished
-- rewriting the country aliases, so it indexes the final state once rather
-- than indexing the old names and then chasing the update.

-- ============================================================================
-- 3. The matcher, rewritten
--
-- Same contract as 0018's: given a location, the place it belongs to, or null.
-- Same two passes, and for the same reason -- find the country first, then
-- look for something finer INSIDE it, so "Davao, Indonesia" is Indonesia and
-- not a Philippine province.
--
-- `grams` is the new part. "cebu city philippines" becomes every contiguous
-- run of words in it -- "cebu", "cebu city", "cebu city philippines", "city",
-- "city philippines", "philippines" -- capped at the longest term the
-- gazetteer actually holds. Each is then a plain indexed lookup.
-- ============================================================================

create or replace function match_map_place(loc text)
returns uuid
language sql
stable
set search_path = public
as $$
  with key as (
    select string_to_array(normalize_location(loc), ' ') as words
  ),
  span as (
    -- Read once, so the matcher keeps working when a longer place name is
    -- added rather than quietly failing to match it.
    select coalesce(max(word_count), 1) as longest from map_place_terms
  ),
  grams as (
    select distinct array_to_string(key.words[i:j], ' ') as term
    from key, span
    cross join lateral generate_subscripts(key.words, 1) as i
    cross join lateral generate_series(i, least(i + span.longest - 1, cardinality(key.words))) as j
    where key.words is not null
  ),
  candidates as (
    select
      p.id,
      p.kind,
      p.country_code,
      max(length(t.term)) as term_length
    from grams g
    join map_place_terms t on t.term = g.term
    join map_places p on p.id = t.place_id
    where length(g.term) >= 2
    group by p.id, p.kind, p.country_code
  ),
  best_country as (
    select id, country_code
    from candidates
    where kind = 'country'
    order by term_length desc, id
    limit 1
  ),
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
-- 4. Resolving every answer in ONE query
--
-- The index above is necessary but not sufficient. match_map_place() is still
-- a per-row function call, and a SQL function with five CTEs costs a few
-- milliseconds of executor setup every time it is invoked no matter how fast
-- the lookup inside it is. Times six hundred distinct answers, that alone was
-- ~4 seconds -- still within sight of the statement timeout, and still growing
-- linearly with every new spelling anyone types.
--
-- So the pages do not call it per row. They call this, which resolves the
-- whole corpus as one set operation: every answer is exploded into n-grams
-- together, joined to the term index once, and the winner per answer picked
-- with DISTINCT ON. Six hundred function invocations become one query.
--
-- match_map_place() is kept for single lookups -- the migration check script
-- uses it, and "what would this one string resolve to?" is a fair question to
-- be able to ask -- but nothing on a page calls it any more.
--
-- The two passes are the same two passes, expressed as two DISTINCT ONs:
-- `countries` is the nation the answer names, `locals` is the finest place
-- inside that nation, and a local beats a country when both exist.
-- ============================================================================

create or replace function map_resolved_locations()
returns table (
  location_key text,
  sample text,
  place_id uuid,
  churches bigint,
  downloads bigint,
  is_assigned boolean
)
language sql
stable
set search_path = public
as $$
  with raw as (
    select 'church' as source, c.location as text_value
    from churches c
    where c.location is not null
    union all
    select 'download', d.church_location
    from download_signups d
    where d.church_location is not null
  ),
  keys as materialized (
    -- Normalised once per row, grouped, and never computed again: everything
    -- below joins on this key. `materialized` is load-bearing -- inlined, the
    -- normalisation would be recomputed in every branch that references it.
    select
      normalize_location(r.text_value) as key,
      min(btrim(r.text_value)) as sample,
      count(*) filter (where r.source = 'church') as churches,
      count(*) filter (where r.source = 'download') as downloads
    from raw r
    group by normalize_location(r.text_value)
    having normalize_location(r.text_value) is not null
  ),
  span as (
    select coalesce(max(word_count), 1) as longest from map_place_terms
  ),
  grams as (
    -- Every contiguous run of whole words in every answer, all at once.
    select k.key, array_to_string(w.words[i:j], ' ') as term
    from keys k
    cross join span
    cross join lateral (select string_to_array(k.key, ' ') as words) w
    cross join lateral generate_subscripts(w.words, 1) as i
    cross join lateral generate_series(i, least(i + span.longest - 1, cardinality(w.words))) as j
  ),
  hits as (
    select distinct
      g.key,
      p.id,
      p.kind,
      p.country_code,
      length(g.term) as term_length
    from grams g
    join map_place_terms t on t.term = g.term
    join map_places p on p.id = t.place_id
    where length(g.term) >= 2
  ),
  countries as (
    select distinct on (key) key, id, country_code
    from hits
    where kind = 'country'
    order by key, term_length desc, id
  ),
  locals as (
    select distinct on (h.key) h.key, h.id
    from hits h
    left join countries c on c.key = h.key
    where h.kind <> 'country'
      -- Confined to the nation the answer named, when it named one. This is
      -- what keeps "Davao, Indonesia" out of the Philippines.
      and (c.key is null or h.country_code is null or h.country_code = c.country_code)
    order by
      h.key,
      case h.kind when 'custom' then 3 when 'province' then 2 else 1 end desc,
      h.term_length desc,
      h.id
  )
  select
    k.key,
    k.sample,
    -- A superadmin's ruling beats the matcher outright, including a ruling of
    -- "nowhere": when an assignment row exists, its place_id is the answer even
    -- when that is null.
    case when a.location_key is not null then a.place_id else coalesce(l.id, c.id) end,
    k.churches,
    k.downloads,
    a.location_key is not null
  from keys k
  left join map_location_assignments a on a.location_key = k.key
  left join locals l on l.key = k.key
  left join countries c on c.key = k.key;
$$;

revoke all on function map_resolved_locations() from public, anon;

-- Now a thin wrapper over the shared resolver.
create or replace function map_pin_counts()
returns table (place_id uuid, churches bigint, downloads bigint)
language sql
stable
set search_path = public
as $$
  select r.place_id, sum(r.churches)::bigint, sum(r.downloads)::bigint
  from map_resolved_locations() r
  where r.place_id is not null
  group by r.place_id;
$$;

revoke all on function map_pin_counts() from public, anon;

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
  select
    r.location_key,
    r.sample,
    r.churches,
    r.downloads,
    r.place_id,
    p.name,
    p.slug,
    r.is_assigned,
    r.is_assigned and r.place_id is null
  from map_resolved_locations() r
  left join map_places p on p.id = r.place_id
  -- Unplaced answers first: those are the ones with work outstanding.
  order by (p.id is not null), (r.churches + r.downloads) desc, r.sample;
end;
$$;

-- ============================================================================
-- 5. Placing an unreadable answer in one step
--
-- The superadmin screen needs to be able to say "I know where 'Brgy. San
-- Roque' is, it is HERE" -- creating a pin at a coordinate and pointing that
-- answer at it. Done from the client that is two writes with no transaction
-- around them, and a failure between them leaves an orphan pin on the public
-- map that nobody asked for. One function, one transaction.
--
-- The answer is optional: dropping a pin with no answer attached is also a
-- thing the operator does.
-- ============================================================================

create or replace function superadmin_add_map_pin(
  pin_name text,
  pin_lat double precision,
  pin_lng double precision,
  for_location_key text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  new_id uuid;
begin
  if not is_superadmin() then
    raise exception 'Not authorised';
  end if;

  insert into map_places (slug, name, kind, lat, lng, source)
  values (
    -- Derived from the name for readability, suffixed for uniqueness: two
    -- operators adding "Grace Chapel" a month apart must not collide.
    coalesce(
      nullif(regexp_replace(lower(normalize_location(pin_name)), '[^a-z0-9]+', '-', 'g'), ''),
      'pin'
    ) || '-' || substr(md5(gen_random_uuid()::text), 1, 6),
    btrim(pin_name),
    'custom',
    pin_lat,
    pin_lng,
    'manual'
  )
  returning id into new_id;

  if for_location_key is not null then
    insert into map_location_assignments (location_key, place_id)
    values (for_location_key, new_id)
    on conflict (location_key) do update set place_id = excluded.place_id;
  end if;

  return new_id;
end;
$$;

revoke all on function superadmin_add_map_pin(text, double precision, double precision, text)
  from public, anon;
grant execute on function superadmin_add_map_pin(text, double precision, double precision, text)
  to authenticated;

-- ============================================================================
-- 6. The names countries actually go by
--
-- 0018 seeded each country under the name Natural Earth gives it, which is the
-- name that fits on a map: "Dem. Rep. Congo", "Eq. Guinea", "S. Sudan",
-- "Bosnia and Herz.", "Central African Rep.". Nobody writes their address that
-- way, so those answers did not merely fail to resolve -- five of them
-- resolved to the WRONG COUNTRY, because the only thing the gazetteer could
-- match was the shorter country whose name is contained in the longer one:
--
--   "South Sudan"                      -> Sudan
--   "Equatorial Guinea"                -> Guinea
--   "Democratic Republic of the Congo" -> Republic of the Congo
--   "South Georgia and the ..."        -> Georgia
--   "People's Republic of China"       -> Taiwan
--
-- Each of those is a pin in a country the church is not in. Fixed by giving
-- every country the names ISO 3166 gives it, in the word order people use.
-- Generated by scripts/generate-world-map.mjs; 34 more countries that merely
-- failed to resolve now resolve too.
--
-- Appended rather than assigned, so the hand-written aliases 0018 added -- the
-- ones ISO does not know, like "gensan", "dubai" and "britain" -- survive. The
-- trigger above re-indexes every row this touches.
-- ============================================================================

update map_places p
set aliases = (
  select coalesce(array_agg(distinct term order by term), '{}')
  from unnest(p.aliases || v.extra) as term
  where term is not null and btrim(term) <> ''
)
from (values
  ('AE', array['uae']),
  ('AG', array['antigua and barbuda']),
  ('AX', array['aland islands']),
  ('BA', array['bosnia and herzegovina']),
  ('BL', array['saint barthelemy']),
  ('BN', array['brunei darussalam']),
  ('CD', array['democratic republic of the congo']),
  ('CF', array['central african republic']),
  ('CG', array['republic of the congo']),
  ('CI', array['ivory coast']),
  ('CK', array['cook islands']),
  ('CN', array['people s republic of china']),
  ('CV', array['cape verde']),
  ('CZ', array['czech republic']),
  ('DO', array['dominican republic']),
  ('EH', array['western sahara']),
  ('FK', array['falkland islands malvinas']),
  ('FM', array['micronesia federated states of']),
  ('FO', array['faroe islands']),
  ('GB', array['great britain', 'uk']),
  ('GM', array['republic of the gambia', 'the gambia']),
  ('GQ', array['equatorial guinea']),
  ('GS', array['south georgia and the south sandwich islands']),
  ('HM', array['heard island and mcdonald islands']),
  ('IO', array['british indian ocean territory']),
  ('IR', array['islamic republic of iran']),
  ('KN', array['saint kitts and nevis']),
  ('KR', array['korea republic of', 'republic of korea']),
  ('KY', array['cayman islands']),
  ('LA', array['lao people s democratic republic']),
  ('MD', array['moldova republic of']),
  ('MF', array['saint martin french part']),
  ('MH', array['marshall islands']),
  ('MK', array['north macedonia', 'the republic of north macedonia']),
  ('MP', array['northern mariana islands']),
  ('NL', array['netherlands kingdom of the', 'the netherlands']),
  ('PF', array['french polynesia']),
  ('PM', array['saint pierre and miquelon']),
  ('PN', array['pitcairn', 'pitcairn islands']),
  ('PS', array['state of palestine']),
  ('RU', array['russian federation']),
  ('SB', array['solomon islands']),
  ('SS', array['south sudan']),
  ('SX', array['sint maarten dutch part']),
  ('SY', array['syrian arab republic']),
  ('TC', array['turks and caicos islands']),
  ('TF', array['french southern territories']),
  ('TR', array['turkiye']),
  ('TW', array['taiwan province of china']),
  ('TZ', array['united republic of tanzania']),
  ('US', array['u s', 'u s a', 'united states', 'us', 'usa']),
  ('VA', array['holy see vatican city state']),
  ('VC', array['saint vincent and the grenadines']),
  ('VG', array['virgin islands british']),
  ('VI', array['virgin islands u s']),
  ('WF', array['wallis and futuna'])
) as v(code, extra)
where p.kind = 'country' and p.country_code = v.code;

-- ============================================================================
-- 7. Build the index
--
-- Everything above is now in its final shape, so index it in one set-based
-- pass rather than by calling rebuild_map_place_terms() three hundred times
-- from a SELECT. Same result, one statement, and it does not depend on how
-- Postgres interleaves per-row function calls that write to the table they are
-- being selected over.
--
-- Truncate-and-rebuild rather than incremental: this runs once, the table is
-- small, and "rebuild it all from the source of truth" is the version that
-- cannot leave a stale term behind.
-- ============================================================================

delete from map_place_terms;

insert into map_place_terms (term, place_id, word_count)
select distinct t.term, p.id, cardinality(string_to_array(t.term, ' '))
from map_places p
cross join lateral (
  select normalize_location(p.name) as term
  union all
  select normalize_location(a) from unnest(p.aliases) as a
) t
where t.term is not null
  and length(t.term) >= 2
on conflict (term, place_id) do nothing;

-- ============================================================================
-- 8. Grants
--
-- map_place_terms is an internal index, not something the client reads. The
-- matcher is SECURITY DEFINER's business; nobody else needs a row from it.
-- ============================================================================

alter table map_place_terms enable row level security;
revoke all on table map_place_terms from anon, authenticated;

revoke all on function rebuild_map_place_terms(uuid) from public, anon, authenticated;
revoke all on function sync_map_place_terms() from public, anon, authenticated;
