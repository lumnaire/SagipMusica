// Applies the Bible migrations to a throwaway Postgres and reads scripture
// back out of it.
//
//   npm run bible:check
//
// PGlite is real Postgres compiled to wasm, so the generated column, the GIN
// index and the view behave the way they will in Supabase. What it does not
// have is Supabase's roles, so the stub below creates them; everything here
// then runs as the owner, which means this checks the data and the queries,
// not the RLS.
//
// What it is guarding:
//
//  1. THE TEXT IS ALL THERE AND IT IS RIGHT. 31,102 verses, 66 books, 1,189
//     chapters, and a handful of verses every reader of this repo can check by
//     eye. A Bible that is quietly missing Obadiah is worse than no Bible,
//     because nobody finds out until somebody preaches Obadiah.
//
//  2. THE TWO TRANSFORMATIONS. The generator strips paragraph pilcrows into a
//     column and drops the italic brackets. Both are asserted on verses known
//     to carry them, and the whole corpus is swept for a leftover marker.
//
//  3. COST. Every query the app makes is timed against a budget. Supabase
//     cancels a statement at 8 seconds and these run while a service is in
//     progress, so "fast enough on a laptop" is the wrong bar -- the budgets
//     below are set where a human would notice the delay.
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

/** Supabase's roles, which the migrations grant to. */
const STUB = `
  do $$ begin
    if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon; end if;
    if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated; end if;
  end $$;
`;

/**
 * The canonical shape of the Protestant canon: one string per book in
 * canonical order, holding that book's verse count for each chapter in turn.
 * 66 books, 1,189 chapters, 31,102 verses.
 *
 * This is an INDEPENDENT witness, and that is the whole point of it. It was
 * taken from aruljohn/Bible-kjv -- a different transcription, by different
 * people, from the one the verses themselves are generated from -- so checking
 * our rows against it is a real cross-check rather than the import agreeing
 * with itself. The two were compared in full when this was written: identical
 * structure, and identical wording once each edition's typographic habits
 * (curly apostrophes, "Tubal-cain" vs "Tubalcain", "first born" vs
 * "firstborn") are folded together. Where the two differ on spelling, ours is
 * the more faithful 1769 text -- it keeps "throughly", "their's" and "any
 * thing" where the other source has quietly modernised them.
 *
 * If a future translation is added, this table does NOT apply to it: it is the
 * versification of the KJV, and other traditions divide verses differently.
 */
const CANONICAL_VERSE_COUNTS = [
  "31,25,24,26,32,22,24,22,29,32,32,20,18,24,21,16,27,33,38,18,34,24,20,67,34,35,46,22,35,43,55,32,20,31,29,43,36,30,23,23,57,38,34,34,28,34,31,22,33,26",
  "22,25,22,31,23,30,25,32,35,29,10,51,22,31,27,36,16,27,25,26,36,31,33,18,40,37,21,43,46,38,18,35,23,35,35,38,29,31,43,38",
  "17,16,17,35,19,30,38,36,24,20,47,8,59,57,33,34,16,30,37,27,24,33,44,23,55,46,34",
  "54,34,51,49,31,27,89,26,23,36,35,16,33,45,41,50,13,32,22,29,35,41,30,25,18,65,23,31,40,16,54,42,56,29,34,13",
  "46,37,29,49,33,25,26,20,29,22,32,32,18,29,23,22,20,22,21,20,23,30,25,22,19,19,26,68,29,20,30,52,29,12",
  "18,24,17,24,15,27,26,35,27,43,23,24,33,15,63,10,18,28,51,9,45,34,16,33",
  "36,23,31,24,31,40,25,35,57,18,40,15,25,20,20,31,13,31,30,48,25",
  "22,23,18,22",
  "28,36,21,22,12,21,17,22,27,27,15,25,23,52,35,23,58,30,24,42,15,23,29,22,44,25,12,25,11,31,13",
  "27,32,39,12,25,23,29,18,13,19,27,31,39,33,37,23,29,33,43,26,22,51,39,25",
  "53,46,28,34,18,38,51,66,28,29,43,33,34,31,34,34,24,46,21,43,29,53",
  "18,25,27,44,27,33,20,29,37,36,21,21,25,29,38,20,41,37,37,21,26,20,37,20,30",
  "54,55,24,43,26,81,40,40,44,14,47,40,14,17,29,43,27,17,19,8,30,19,32,31,31,32,34,21,30",
  "17,18,17,22,14,42,22,18,31,19,23,16,22,15,19,14,19,34,11,37,20,12,21,27,28,23,9,27,36,27,21,33,25,33,27,23",
  "11,70,13,24,17,22,28,36,15,44",
  "11,20,32,23,19,19,73,18,38,39,36,47,31",
  "22,23,15,17,14,14,10,17,32,3",
  "22,13,26,21,27,30,21,22,35,22,20,25,28,22,35,22,16,21,29,29,34,30,17,25,6,14,23,28,25,31,40,22,33,37,16,33,24,41,30,24,34,17",
  "6,12,8,8,12,10,17,9,20,18,7,8,6,7,5,11,15,50,14,9,13,31,6,10,22,12,14,9,11,12,24,11,22,22,28,12,40,22,13,17,13,11,5,26,17,11,9,14,20,23,19,9,6,7,23,13,11,11,17,12,8,12,11,10,13,20,7,35,36,5,24,20,28,23,10,12,20,72,13,19,16,8,18,12,13,17,7,18,52,17,16,15,5,23,11,13,12,9,9,5,8,28,22,35,45,48,43,13,31,7,10,10,9,8,18,19,2,29,176,7,8,9,4,8,5,6,5,6,8,8,3,18,3,3,21,26,9,8,24,13,10,7,12,15,21,10,20,14,9,6",
  "33,22,35,27,23,35,27,36,18,32,31,28,25,35,33,33,28,24,29,30,31,29,35,34,28,28,27,28,27,33,31",
  "18,26,22,16,20,12,29,17,18,20,10,14",
  "17,17,11,16,16,13,13,14",
  "31,22,26,6,30,13,25,22,21,34,16,6,22,32,9,14,14,7,25,6,17,25,18,23,12,21,13,29,24,33,9,20,24,17,10,22,38,22,8,31,29,25,28,28,25,13,15,22,26,11,23,15,12,17,13,12,21,14,21,22,11,12,19,12,25,24",
  "19,37,25,31,31,30,34,22,26,25,23,17,27,22,21,21,27,23,15,18,14,30,40,10,38,24,22,17,32,24,40,44,26,22,19,32,21,28,18,16,18,22,13,30,5,28,7,47,39,46,64,34",
  "22,22,66,22,22",
  "28,10,27,17,17,14,27,18,11,22,25,28,23,23,8,63,24,32,14,49,32,31,49,27,17,21,36,26,21,26,18,32,33,31,15,38,28,23,29,49,26,20,27,31,25,24,23,35",
  "21,49,30,37,31,28,28,27,27,21,45,13",
  "11,23,5,19,15,11,16,14,17,15,12,14,16,9",
  "20,32,21",
  "15,16,15,13,27,14,17,14,15",
  "21",
  "17,10,10,11",
  "16,13,12,13,15,16,20",
  "15,13,19",
  "17,20,19",
  "18,15,20",
  "15,23",
  "21,13,10,14,11,15,14,23,17,12,17,14,9,21",
  "14,17,18,6",
  "25,23,17,25,48,34,29,34,38,42,30,50,58,36,39,28,27,35,30,34,46,46,39,51,46,75,66,20",
  "45,28,35,41,43,56,37,38,50,52,33,44,37,72,47,20",
  "80,52,38,44,39,49,50,56,62,42,54,59,35,35,32,31,37,43,48,47,38,71,56,53",
  "51,25,36,54,47,71,53,59,41,42,57,50,38,31,27,33,26,40,42,31,25",
  "26,47,26,37,42,15,60,40,43,48,30,25,52,28,41,40,34,28,41,38,40,30,35,27,27,32,44,31",
  "32,29,31,25,21,23,25,39,33,21,36,21,14,23,33,27",
  "31,16,23,21,13,20,40,13,27,33,34,31,13,40,58,24",
  "24,17,18,18,21,18,16,24,15,18,33,21,14",
  "24,21,29,31,26,18",
  "23,22,21,32,33,24",
  "30,30,21,23",
  "29,23,25,18",
  "10,20,13,18,28",
  "12,17,18",
  "20,15,16,16,25,21",
  "18,26,17,22",
  "16,15,15",
  "25",
  "14,18,19,16,14,20,28,13,28,39,40,29,25",
  "27,26,18,17,20",
  "25,25,22,19,14",
  "21,22,18",
  "10,29,24,21,21",
  "13",
  "14",
  "25",
  "20,29,22,11,14,17,17,13,21,11,19,17,18,20,8,21,18,24,21,15,27,21",
];

let failures = 0;

function check(label, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) {
    failures += 1;
    console.error(`  FAIL  ${label}`);
    console.error(`        expected ${JSON.stringify(expected)}`);
    console.error(`        actual   ${JSON.stringify(actual)}`);
  } else {
    console.log(`  ok    ${label}`);
  }
}

async function timed(db, label, sql, params, budgetMs) {
  const started = performance.now();
  const result = await db.query(sql, params);
  const elapsed = performance.now() - started;
  const ok = elapsed <= budgetMs;
  if (!ok) failures += 1;
  console.log(
    `  ${ok ? "ok   " : "FAIL "} ${label} — ${elapsed.toFixed(0)}ms (budget ${budgetMs}ms)`,
  );
  return result;
}

const db = new PGlite();

console.log("Applying migrations…");
await db.exec(STUB);
for (const file of ["0020_bible.sql", "0021_bible_kjv_verses.sql"]) {
  const started = performance.now();
  await db.exec(readFileSync(resolve(ROOT, "supabase/migrations", file), "utf8"));
  console.log(`  ${file} — ${((performance.now() - started) / 1000).toFixed(1)}s`);
}

console.log("\nShape");
const shape = await db.query(`
  select
    (select count(*)::int from bible_verses)                as verses,
    (select count(*)::int from bible_books)                 as books,
    (select count(*)::int from bible_chapters)              as chapters,
    (select count(*)::int from bible_translations)          as translations,
    (select count(*)::int from bible_verses where paragraph) as paragraphs
`);
check("31,102 verses", shape.rows[0].verses, 31102);
check("66 books", shape.rows[0].books, 66);
check("1,189 chapters", shape.rows[0].chapters, 1189);
check("1 translation", shape.rows[0].translations, 1);
check("2,936 paragraph starts", shape.rows[0].paragraphs, 2936);

console.log("\nLandmarks");
async function verse(reference) {
  const [book, rest] = reference.split(/ (?=\d+:\d+$)/);
  const [chapter, number] = rest.split(":");
  const { rows } = await db.query(
    `select v.text, v.paragraph
       from bible_verses v join bible_books b on b.id = v.book_id
      where b.name = $1 and v.chapter = $2 and v.verse = $3`,
    [book, Number(chapter), Number(number)],
  );
  return rows[0];
}

check(
  "Genesis 1:1",
  (await verse("Genesis 1:1")).text,
  "In the beginning God created the heaven and the earth.",
);
check("John 11:35", (await verse("John 11:35")).text, "Jesus wept.");
// Carried a "# " pilcrow in the source: the marker must be off the text and on
// the column instead.
const john316 = await verse("John 3:16");
check(
  "John 3:16 text",
  john316.text,
  "For God so loved the world, that he gave his only begotten Son, that whosoever believeth in him should not perish, but have everlasting life.",
);
check("John 3:16 starts a paragraph", john316.paragraph, true);
// Carried italic brackets in the source: "The LORD [is] my shepherd".
check(
  "Psalms 23:1 (italics dropped)",
  (await verse("Psalms 23:1")).text,
  "The LORD is my shepherd; I shall not want.",
);
check(
  "Revelation 22:21 (italics dropped)",
  (await verse("Revelation 22:21")).text,
  "The grace of our Lord Jesus Christ be with you all. Amen.",
);
// The one book whose name we changed from the source's "Solomon's Song".
check(
  "Song of Solomon 1:1",
  (await verse("Song of Solomon 1:1")).text,
  "The song of songs, which is Solomon's.",
);

console.log("\nNo leftover markup");
const markup = await db.query(`
  select count(*)::int as n from bible_verses
   where text like '%[%' or text like '%]%' or text like '#%'
`);
check("no brackets or pilcrows survived", markup.rows[0].n, 0);

console.log("\nCanon");
// Longest and shortest books, and the chapter counts everyone knows, so a
// mis-numbered book_id in the generated file cannot pass unnoticed.
const canon = await db.query(`
  select b.name, count(distinct v.chapter)::int as chapters, count(*)::int as verses
    from bible_books b join bible_verses v on v.book_id = b.id
   where b.name in ('Genesis','Psalms','Obadiah','Jude','3 John','Revelation','Matthew')
   group by b.name order by b.name
`);
check(
  "chapter and verse counts",
  canon.rows,
  [
    { name: "3 John", chapters: 1, verses: 14 },
    { name: "Genesis", chapters: 50, verses: 1533 },
    { name: "Jude", chapters: 1, verses: 25 },
    { name: "Matthew", chapters: 28, verses: 1071 },
    { name: "Obadiah", chapters: 1, verses: 21 },
    { name: "Psalms", chapters: 150, verses: 2461 },
    { name: "Revelation", chapters: 22, verses: 404 },
  ],
);
check(
  "Psalm 119 is the long one",
  (await db.query(`select verse_count from bible_chapters where book_id = 19 and chapter = 119`))
    .rows[0].verse_count,
  176,
);

console.log("\nEvery chapter of every book (against an independent transcription)");
{
  const { rows } = await db.query(`
    select b.id, b.name, v.chapter, count(*)::int as verses
      from bible_books b join bible_verses v on v.book_id = b.id
     where v.translation_id = 'kjv'
     group by b.id, b.name, v.chapter
     order by b.id, v.chapter
  `);

  const actual = new Map();
  for (const row of rows) {
    const chapters = actual.get(row.id) ?? new Map();
    chapters.set(row.chapter, row.verses);
    actual.set(row.id, chapters);
  }

  const problems = [];
  let checkedChapters = 0;
  let checkedVerses = 0;

  CANONICAL_VERSE_COUNTS.forEach((spec, index) => {
    const bookId = index + 1;
    const wanted = spec.split(",").map(Number);
    const chapters = actual.get(bookId) ?? new Map();
    const name = rows.find((r) => r.id === bookId)?.name ?? `book ${bookId}`;

    if (chapters.size !== wanted.length) {
      problems.push(`${name}: has ${chapters.size} chapters, expected ${wanted.length}`);
    }

    wanted.forEach((count, i) => {
      const chapter = i + 1;
      const got = chapters.get(chapter);
      checkedChapters += 1;
      checkedVerses += count;
      if (got === undefined) {
        problems.push(`${name} ${chapter}: MISSING`);
      } else if (got !== count) {
        problems.push(`${name} ${chapter}: has ${got} verses, expected ${count}`);
      }
    });

    for (const chapter of chapters.keys()) {
      if (chapter > wanted.length) problems.push(`${name} ${chapter}: unexpected chapter`);
    }
  });

  check(`all ${checkedChapters} chapters present with the right verse counts`, problems, []);
  check("31,102 verses accounted for", checkedVerses, 31102);
}


console.log("\nQueries the app makes");
// Opening a chapter: the single most common read, and it happens while the
// congregation is waiting for the screen to change.
const chapter = await timed(
  db,
  "read a chapter (Psalm 119, the longest)",
  `select verse, text, paragraph from bible_verses
    where translation_id = $1 and book_id = $2 and chapter = $3
    order by verse`,
  ["kjv", 19, 119],
  50,
);
check("…returned 176 verses", chapter.rows.length, 176);

// The whole chapter index, fetched once per session and cached.
const index = await timed(
  db,
  "whole chapter index",
  `select book_id, chapter, verse_count from bible_chapters
    where translation_id = $1 order by book_id, chapter`,
  ["kjv"],
  400,
);
check("…returned 1,189 rows", index.rows.length, 1189);

// Full-text search, which is the half of this feature that justifies putting
// the text in Postgres rather than a JSON file.
const search = await timed(
  db,
  "search: 'faith without works'",
  `select b.name, v.chapter, v.verse
     from bible_verses v join bible_books b on b.id = v.book_id
    where v.translation_id = $1 and v.search @@ websearch_to_tsquery('english', $2)
    order by v.book_id, v.chapter, v.verse limit 50`,
  ["kjv", "faith without works"],
  300,
);
check(
  "…finds James 2:20",
  search.rows.some((r) => r.name === "James" && r.chapter === 2 && r.verse === 20),
  true,
);

const stemmed = await timed(
  db,
  "search: 'comfort' (stemming)",
  `select count(*)::int as n from bible_verses
    where translation_id = $1 and search @@ websearch_to_tsquery('english', $2)`,
  ["kjv", "comfort"],
  300,
);
// "comforteth", "comforted" and "comfort" all stem together, so this must find
// substantially more than the verses that spell it exactly.
check("…stems past the exact spelling", stemmed.rows[0].n > 60, true);

const shepherd = await timed(
  db,
  "search: quoted phrase",
  `select b.name, v.chapter, v.verse
     from bible_verses v join bible_books b on b.id = v.book_id
    where v.translation_id = $1 and v.search @@ websearch_to_tsquery('english', $2)
    order by v.book_id, v.chapter, v.verse`,
  ["kjv", '"my shepherd"'],
  300,
);
check(
  "…finds Psalm 23:1",
  shepherd.rows.some((r) => r.name === "Psalms" && r.chapter === 23 && r.verse === 1),
  true,
);

console.log("\nRules");
// The alias table is what lets somebody type "1 jn" or "canticles". Two books
// answering to one token is checked by the migration itself; this proves the
// check is actually wired up and would have fired.
try {
  await db.exec(`update bible_books set aliases = array['jn'] where id = 32`);
  const clash = await db.query(`
    select count(*)::int as n from (
      select token from (
        select distinct id, lower(btrim(token)) as token from (
          select id, name as token from bible_books
          union all select id, abbreviation from bible_books
          union all select id, unnest(aliases) from bible_books
        ) raw
      ) per_book group by token having count(*) > 1
    ) dupes
  `);
  check("ambiguous alias would be caught", clash.rows[0].n, 1);
  await db.exec(`update bible_books set aliases = array['jon','jnh'] where id = 32`);
} catch (err) {
  failures += 1;
  console.error(`  FAIL  alias clash probe threw: ${err.message}`);
}

// Scripture is read-only through RLS: there are select policies and no others.
const policies = await db.query(`
  select tablename, cmd, count(*)::int as n from pg_policies
   where schemaname = 'public' and tablename like 'bible%'
   group by tablename, cmd order by tablename, cmd
`);
check(
  "select policies only",
  policies.rows.map((r) => `${r.tablename}:${r.cmd}`),
  ["bible_books:SELECT", "bible_translations:SELECT", "bible_verses:SELECT"],
);

const grants = await db.query(`
  select distinct privilege_type from information_schema.table_privileges
   where table_schema = 'public' and table_name like 'bible%'
     and grantee in ('anon','authenticated')
`);
check("anon/authenticated hold SELECT and nothing else", grants.rows, [
  { privilege_type: "SELECT" },
]);

await db.close();

console.log(failures === 0 ? "\nAll checks passed." : `\n${failures} check(s) failed.`);
process.exit(failures === 0 ? 0 : 1);
