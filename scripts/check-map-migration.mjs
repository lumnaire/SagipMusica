// Applies the pin-map migrations to a throwaway Postgres and interrogates them
// with the kind of answers the two forms actually collect.
//
//   npm run map:check
//
// PGlite is real Postgres compiled to wasm, so the regexes, the array handling
// and the CTEs behave the way they will in Supabase. What it does not have is
// Supabase's `auth` schema or its roles, so the stub below stands in for the
// parts of migrations 0004-0017 that these two lean on. That means this checks
// the matcher, the aggregation and the cost -- not the RLS, since everything
// here runs as the owner.
//
// Three things it is guarding, in order of how badly they have already gone
// wrong:
//
//  1. COST. 0018's matcher took 23 seconds on a few thousand rows and Supabase
//     cancels a statement at 8, so both pages returned 500 and the console
//     filled with 57014. Every query the app makes is timed here against a
//     budget, on data an order of magnitude larger than the real thing.
//
//  2. AGREEMENT. There are now two implementations of the same matching rules
//     -- match_map_place() for one string, map_resolved_locations() for the
//     whole corpus at once. Two implementations of one rule is exactly how a
//     pin ends up in a different place depending on which page you loaded, so
//     they are checked against each other on every case below.
//
//  3. MEANING. The cases themselves: real spellings, and the collisions the
//     alias lists were written to resolve.
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import isoCountries from "i18n-iso-countries";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

/** Just enough of the real schema for the migrations to compile and run. */
const STUB = `
  create schema if not exists auth;
  create table auth.users (id uuid primary key default gen_random_uuid());
  create function auth.uid() returns uuid language sql stable as $$ select null::uuid $$;

  do $$ begin
    if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon; end if;
    if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated; end if;
  end $$;

  create function set_updated_at() returns trigger language plpgsql as $$
  begin new.updated_at := now(); return new; end $$;

  create function is_superadmin() returns boolean language sql stable as $$ select true $$;

  create table churches (
    id uuid primary key default gen_random_uuid(),
    name text not null,
    location text
  );

  create table download_signups (
    id uuid primary key default gen_random_uuid(),
    signup_type text not null default 'church',
    church_name text,
    church_location text
  );
`;

const MIGRATIONS = ["0018_map_pins.sql", "0019_map_matcher_index.sql"];

// What people type, and where it has to land. Every left-hand side here is
// either a spelling one of the two forms has plausibly already received or a
// collision the alias lists were written to resolve.
const CASES = [
  // The plain cases.
  ["Cebu City, Philippines", "ph-cebu"],
  ["cebu city", "ph-cebu"],
  ["Cebu", "ph-cebu"],
  ["  Cebu  City , Philippines ", "ph-cebu"],
  ["Manila, Philippines", "ph-metro-manila"],
  ["Philippines", "country-ph"],
  ["Thailand", "country-th"],
  ["Dhaka, Bangladesh", "country-bd"],
  ["Dubai, UAE", "country-ae"],
  ["India", "country-in"],

  // Accents and punctuation, which Filipino place names are full of.
  ["Dasmariñas, Cavite", "ph-cavite"],
  ["Biñan City, Laguna", "ph-laguna"],
  ["Los Baños", "ph-laguna"],

  // The collisions the longest-term rule exists to settle.
  ["Quezon City", "ph-metro-manila"],
  ["Quezon Province", "ph-quezon"],
  ["Lucena City, Quezon", "ph-quezon"],
  ["Cagayan de Oro City", "ph-misamis-oriental"],
  ["Tuguegarao, Cagayan", "ph-cagayan"],
  ["Cotabato City", "ph-maguindanao"],
  ["Kidapawan, North Cotabato", "ph-cotabato"],
  ["South Cotabato", "ph-south-cotabato"],
  ["General Santos City", "ph-south-cotabato"],
  ["Isabela City, Basilan", "ph-basilan"],
  ["Ilagan, Isabela", "ph-isabela"],
  ["Davao City", "ph-davao-city"],
  ["Davao", "ph-davao-city"],
  ["Digos, Davao del Sur", "ph-davao-del-sur"],
  ["Tagum City, Davao del Norte", "ph-davao-del-norte"],

  // Cities that are the only thing anyone ever writes.
  ["Baguio City", "ph-benguet"],
  ["Bacolod City", "ph-negros-occidental"],
  ["Tacloban", "ph-leyte"],
  ["Butuan City", "ph-agusan-del-norte"],
  ["Iligan City", "ph-lanao-del-norte"],
  ["Puerto Princesa, Palawan", "ph-palawan"],
  ["Angeles City, Pampanga", "ph-pampanga"],
  ["Antipolo City, Rizal", "ph-rizal"],
  ["Olongapo", "ph-zambales"],
  ["Dumaguete", "ph-negros-oriental"],
  ["Tagbilaran City, Bohol", "ph-bohol"],
  ["Naga City, Camarines Sur", "ph-camarines-sur"],
  ["Legazpi, Albay", "ph-albay"],

  // A province named with its country, and an island group named alone.
  ["Iloilo, Philippines", "ph-iloilo"],
  ["Mindanao", "ph-mindanao"],
  ["Luzon, Philippines", "ph-luzon"],

  // The country guard: a province name inside another nation must not win.
  ["Davao, Indonesia", "country-id"],
  ["Isabela, Puerto Rico", "country-pr"],

  // Word boundaries. An n-gram is a run of WHOLE words, so a place name buried
  // inside a longer word must not match.
  ["Cebuano-speaking congregation", null],
  ["Romana", null],
  ["nowhere in particular", null],
  ["", null],
  [null, null],

  // Abroad.
  ["Singapore", "country-sg"],
  ["Riyadh, Saudi Arabia", "country-sa"],
  ["Hong Kong", "country-hk"],
  ["Auckland, New Zealand", "country-nz"],
  ["Toronto, Canada", "country-ca"],
  ["London, UK", "country-gb"],
  ["Nairobi, Kenya", "country-ke"],
  // A long country name, to prove the n-gram width is read from the data
  // rather than being a magic number.
  ["Kinshasa, Democratic Republic of the Congo", "country-cd"],
];

let failures = 0;
const fail = (message) => {
  failures++;
  console.log(`  FAIL  ${message}`);
};
const ok = (message) => console.log(`  ok    ${message}`);

const db = await PGlite.create();
await db.exec(STUB);
for (const migration of MIGRATIONS) {
  await db.exec(readFileSync(resolve(ROOT, "supabase/migrations", migration), "utf8"));
}

const one = async (sql, params) => (await db.query(sql, params)).rows[0];

// ---------------------------------------------------------------------------
// The gazetteer and its index
// ---------------------------------------------------------------------------

const seeded = await db.query(
  `select kind, count(*)::int as n from map_places group by kind order by kind`,
);
console.log("\nseeded:", seeded.rows.map((r) => `${r.n} ${r.kind}`).join(", "));

const terms = await one(
  `select count(*)::int as n, max(word_count)::int as longest from map_place_terms`,
);
console.log(`terms:  ${terms.n} searchable, longest ${terms.longest} words`);

// Every place must be searchable, or it is on the map and unreachable.
const orphans = await one(
  `select count(*)::int as n from map_places p
   where not exists (select 1 from map_place_terms t where t.place_id = p.id)`,
);
if (orphans.n > 0) fail(`${orphans.n} places have no search terms`);
else ok("every place has at least one search term");

// ---------------------------------------------------------------------------
// 1. Meaning, and 2. agreement between the two implementations
// ---------------------------------------------------------------------------

console.log("\nmatcher");
await db.exec(`create temp table probe (id int, raw text)`);
for (const [i, [input]] of CASES.entries()) {
  await db.query(`insert into probe values ($1, $2)`, [i, input]);
}

let wrong = 0;
for (const [input, expected] of CASES) {
  const row = await one(`select p.slug from map_places p where p.id = match_map_place($1)`, [input]);
  const got = row?.slug ?? null;
  if (got !== expected) {
    wrong++;
    fail(`${JSON.stringify(input)} -> expected ${expected}, got ${got}`);
  }
}
if (wrong === 0) ok(`all ${CASES.length} spellings resolve as intended`);

// The corpus resolver has to agree with the single-string one on every case.
// Loaded as churches so map_resolved_locations() sees them.
await db.exec(`delete from churches`);
for (const [input] of CASES) {
  if (input) await db.query(`insert into churches (name, location) values ('probe', $1)`, [input]);
}
const disagreements = await db.query(`
  select r.sample,
         (select slug from map_places where id = r.place_id) as corpus,
         (select slug from map_places where id = match_map_place(r.location_key)) as single
  from map_resolved_locations() r
  where r.place_id is distinct from match_map_place(r.location_key)
`);
if (disagreements.rows.length > 0) {
  for (const d of disagreements.rows) {
    fail(`${JSON.stringify(d.sample)}: corpus says ${d.corpus}, single says ${d.single}`);
  }
} else {
  ok("map_resolved_locations() agrees with match_map_place() on every case");
}

// ---------------------------------------------------------------------------
// Every country, under every name ISO gives it
//
// Natural Earth names countries to fit on a map -- "Dem. Rep. Congo",
// "Eq. Guinea", "S. Sudan" -- and 0018 seeded those names verbatim. The result
// was not just missed matches: FIVE countries resolved to a different country,
// because the only term the gazetteer held was an abbreviation, leaving the
// shorter country whose name is contained in the longer one to win. "South
// Sudan" landed on Sudan, "Equatorial Guinea" on Guinea.
//
// A spot-check would not have found those. This sweeps all 234.
// ---------------------------------------------------------------------------

console.log("\ncountry names");
{
  const seededCountries = (
    await db.query(`select slug, name, country_code from map_places where kind = 'country'`)
  ).rows;

  // A name that IS another country's name is not that country's to claim:
  // "Congo" belongs to the Republic of the Congo however many lists offer it
  // as a name for its neighbour.
  const ownNames = new Set(
    seededCountries.map((c) => c.name.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim()),
  );

  let checked = 0;
  const misfiled = [];
  for (const country of seededCountries) {
    const own = country.name.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
    const candidates = new Set();
    const primary = isoCountries.getName(country.country_code, "en");
    if (primary) candidates.add(primary);
    for (const alt of isoCountries.getNames("en", { select: "all" })[country.country_code] ?? []) {
      candidates.add(alt);
    }

    for (const candidate of candidates) {
      const folded = candidate
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, " ")
        .trim();
      if (folded !== own && ownNames.has(folded)) continue;

      checked++;
      const got = (
        await db.query(`select p.slug from map_places p where p.id = match_map_place($1)`, [
          candidate,
        ])
      ).rows[0]?.slug;
      // A name that resolves NOWHERE is a gap -- the answer lands in the
      // review list, which is recoverable. A name that resolves to the WRONG
      // country is a pin in a country the church is not in, which is not.
      if (got && got !== country.slug) {
        misfiled.push(`"${candidate}" -> ${got}, should be ${country.slug}`);
      } else if (!got) {
        misfiled.push(`"${candidate}" -> nothing, should be ${country.slug}`);
      }
    }
  }

  if (misfiled.length > 0) {
    for (const m of misfiled) fail(m);
  } else {
    ok(`all ${checked} ISO country names resolve to their own country`);
  }
}

// ---------------------------------------------------------------------------
// Aggregation, on data shaped like the real thing
// ---------------------------------------------------------------------------

console.log("\naggregation");
await db.exec(`
  delete from churches;
  delete from download_signups;
  insert into churches (name, location) values
    ('A', 'Cebu City, Philippines'),
    ('B', 'cebu city'),
    ('C', 'Mandaue, Cebu'),
    ('D', 'Quezon City'),
    ('E', 'Bangkok, Thailand'),
    ('F', 'asdfgh');
  insert into download_signups (church_name, church_location) values
    ('G', 'Cebu'),
    ('H', 'Lapu-Lapu City'),
    ('I', 'Davao City'),
    ('J', 'asdfgh');
`);

const cebu = await one(`select * from public_map_pins() where slug = 'ph-cebu'`);
if (cebu && Number(cebu.churches) === 3 && Number(cebu.downloads) === 2) {
  ok("five spellings of Cebu collapse onto one pin (3 churches, 2 downloads)");
} else {
  fail(`Cebu should be 3c/2d, got ${cebu?.churches}c/${cebu?.downloads}d`);
}

const unplaced = await db.query(
  `select location_key, churches, downloads from superadmin_map_locations() where place_id is null`,
);
if (unplaced.rows.length === 1 && unplaced.rows[0].location_key === "asdfgh") {
  ok("the unreadable answer is listed for review rather than dropped");
} else {
  fail(`expected one unplaced answer, got ${JSON.stringify(unplaced.rows)}`);
}

// ---------------------------------------------------------------------------
// The superadmin's corrections
// ---------------------------------------------------------------------------

console.log("\ncorrections");

await db.exec(`
  insert into map_location_assignments (location_key, place_id)
  values ('asdfgh', (select id from map_places where slug = 'ph-bohol'));
`);
const bohol = await one(`select * from public_map_pins() where slug = 'ph-bohol'`);
if (bohol && Number(bohol.churches) === 1 && Number(bohol.downloads) === 1) {
  ok("assigning an unreadable answer moves it onto the chosen pin");
} else {
  fail(`assignment: expected Bohol 1c/1d, got ${bohol?.churches}c/${bohol?.downloads}d`);
}

await db.exec(`update map_location_assignments set place_id = null where location_key = 'asdfgh'`);
if (await one(`select * from public_map_pins() where slug = 'ph-bohol'`)) {
  fail("a null assignment should keep the answer off the map");
} else {
  ok("ruling an answer 'nowhere' keeps it off the map");
}

await db.exec(`delete from map_location_assignments where location_key = 'asdfgh'`);
const restored = await one(`select place_id from superadmin_map_locations() where location_key = 'asdfgh'`);
if (restored && restored.place_id === null) {
  ok("clearing a ruling hands the answer back to the matcher");
} else {
  fail(`clearing a ruling: got ${JSON.stringify(restored)}`);
}

await db.exec(`update map_places set is_hidden = true where slug = 'ph-cebu'`);
const publicCebu = await one(`select * from public_map_pins() where slug = 'ph-cebu'`);
const adminCebu = await one(`select * from superadmin_map_pins() where slug = 'ph-cebu'`);
if (!publicCebu && adminCebu && Number(adminCebu.churches) === 3) {
  ok("hiding a pin removes it from the public map but not the operator's");
} else {
  fail("hide");
}
await db.exec(`update map_places set is_hidden = false where slug = 'ph-cebu'`);

// ---------------------------------------------------------------------------
// Dropping a pin by hand, with and without an answer attached
// ---------------------------------------------------------------------------

console.log("\nhand-placed pins");

await db.query(
  `select superadmin_add_map_pin('Sagada, Mountain Province', 17.08, 120.9) as id`,
);
const plainPin = await one(`select * from public_map_pins() where name = 'Sagada, Mountain Province'`);
if (plainPin && Number(plainPin.churches) === 0) {
  ok("a hand-placed pin shows on the public map with nothing behind it");
} else {
  fail("hand-placed pin did not reach the public map");
}

// The flow that matters: an answer nobody could read, placed where it belongs.
await db.exec(`insert into churches (name, location) values ('K', 'Brgy. San Roque')`);
const key = (await one(`select normalize_location('Brgy. San Roque') as k`)).k;
await db.query(
  `select superadmin_add_map_pin('San Roque Chapel', 14.55, 121.02, $1) as id`,
  [key],
);
const attachedPin = await one(`select * from public_map_pins() where name = 'San Roque Chapel'`);
const nowPlaced = await one(
  `select place_name, is_assigned from superadmin_map_locations() where location_key = $1`,
  [key],
);
if (
  attachedPin &&
  Number(attachedPin.churches) === 1 &&
  nowPlaced?.place_name === "San Roque Chapel" &&
  nowPlaced.is_assigned === true
) {
  ok("placing an unreadable answer creates the pin and points the answer at it");
} else {
  fail(
    `place-and-assign: pin ${JSON.stringify(attachedPin)}, review row ${JSON.stringify(nowPlaced)}`,
  );
}

// Names that normalise to nothing must still produce a legal slug.
const odd = await one(`select superadmin_add_map_pin('!!! ???', 1.0, 1.0) as id`);
if (odd?.id) ok("a pin named with punctuation alone still gets a valid slug");
else fail("punctuation-only pin name");

// Two pins with the same name must not collide on their slug.
await db.exec(`select superadmin_add_map_pin('Grace Chapel', 10.0, 123.0)`);
const twin = await one(`select superadmin_add_map_pin('Grace Chapel', 11.0, 124.0) as id`);
if (twin?.id) ok("two pins can share a name without colliding");
else fail("duplicate pin name");

// Editing a place's aliases must re-index it, or the edit does nothing.
await db.exec(`
  update map_places set aliases = array['sagada town'] where name = 'Sagada, Mountain Province'
`);
const reindexed = await one(
  `select p.slug from map_places p where p.id = match_map_place('sagada town')`,
);
if (reindexed) ok("editing a place's aliases re-indexes it for the matcher");
else fail("alias edit did not reach map_place_terms");

// ---------------------------------------------------------------------------
// Cost, on far more data than exists
// ---------------------------------------------------------------------------

console.log("\ncost");

await db.exec(`delete from churches; delete from download_signups;`);
await db.exec(`
  insert into churches (name, location)
  select
    'Church ' || g,
    (array[
      'Cebu City, Philippines','Quezon City','Davao','Bacolod City','Iloilo City',
      'Tacloban','Baguio City','Cagayan de Oro','General Santos City','Naga City, Camarines Sur',
      'Bangkok, Thailand','Dhaka, Bangladesh','Dubai, UAE','Singapore','Brgy. San Roque',
      'Marikina','Antipolo, Rizal','Ormoc City, Leyte','Koronadal','Butuan'
    ])[1 + (g % 20)]
    -- Every fourth row gets a suffix nobody else has, so the corpus carries
    -- thousands of DISTINCT spellings rather than twenty popular ones. That is
    -- the axis the old matcher died on.
    || case when g % 4 = 0 then ' ' || g::text else '' end
  from generate_series(1, 20000) g;

  insert into download_signups (church_name, church_location)
  select
    'Download ' || g,
    (array['Cebu','Manila','Davao City','Iloilo','Leyte','Pampanga','Laguna','Cavite'])[1 + (g % 8)]
    || case when g % 3 = 0 then ', Philippines ' || g::text else '' end
  from generate_series(1, 10000) g;
`);

const scale = await one(`
  select
    (select count(*)::int from churches) as churches,
    (select count(*)::int from download_signups) as downloads,
    (select count(*)::int from (
      select normalize_location(location) k from churches where location is not null
      union
      select normalize_location(church_location) from download_signups where church_location is not null
    ) s) as distinct_answers
`);
console.log(
  `  ${scale.churches} churches + ${scale.downloads} downloads, ` +
    `${scale.distinct_answers} distinct answers`,
);

// PGlite is wasm and runs perhaps an order of magnitude slower than the
// managed Postgres this deploys to, so a budget that passes here has real
// headroom against Supabase's 8-second statement timeout.
//
// BEST of several runs, not a single one. A single timing measures the query
// plus whatever else the machine was doing, and this check has already failed
// once at 6.0s and passed at 2.2s on the same code, minutes apart, because a
// dev server happened to be running. A check that flakes is worse than no
// check -- people learn to re-run it until it goes green, which is the same as
// deleting it. The fastest run is the one least polluted by contention, and it
// is still an order of magnitude away from a real regression: the matcher this
// replaced took 23 SECONDS on a fifth of this data.
const BUDGET_MS = 4000;
const RUNS = 3;

for (const [label, sql] of [
  ["public_map_pins()", "select count(*) from public_map_pins()"],
  ["superadmin_map_pins()", "select count(*) from superadmin_map_pins()"],
  ["superadmin_map_locations()", "select count(*) from superadmin_map_locations()"],
]) {
  const timings = [];
  for (let run = 0; run < RUNS; run++) {
    const started = performance.now();
    await db.query(sql);
    timings.push(Math.round(performance.now() - started));
  }
  const best = Math.min(...timings);
  const line =
    `${label} took ${best}ms on ${scale.distinct_answers} distinct answers ` +
    `(best of ${timings.join("/")})`;
  if (best > BUDGET_MS) fail(`${line} -- budget ${BUDGET_MS}ms`);
  else ok(line);
}

await db.close();

console.log(failures === 0 ? "\nall checks passed" : `\n${failures} FAILURES`);
process.exit(failures === 0 ? 0 : 1);
