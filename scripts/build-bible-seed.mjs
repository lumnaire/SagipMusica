// Generates desktop/resources/bible-seed.json — the Bible that ships inside
// the desktop installer — from the committed Supabase migrations.
//
//   npm run bible:seed
//
// The migrations are APPLIED to a throwaway Postgres and the rows are read
// back out, rather than the SQL being parsed by hand. That matters: it means
// the desktop's copy of scripture is by construction the same rows the hosted
// app serves, including every transformation 0021 made on the way in. A
// bespoke parser for 5MB of generated INSERTs would be one more thing that
// could be subtly wrong, and being subtly wrong about the Bible is the exact
// failure this whole feature exists to avoid.
//
// The output is committed so a clean checkout can build the desktop app.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = resolve(ROOT, "desktop/resources/bible-seed.json");

const EXPECTED_VERSES = 31102;
const EXPECTED_BOOKS = 66;

const db = new PGlite();

// The migrations grant to Supabase's roles, which a bare Postgres has not got.
await db.exec(`
  do $$ begin
    if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon; end if;
    if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated; end if;
  end $$;
`);

for (const file of ["0020_bible.sql", "0021_bible_kjv_verses.sql"]) {
  process.stdout.write(`Applying ${file}… `);
  const started = Date.now();
  await db.exec(readFileSync(resolve(ROOT, "supabase/migrations", file), "utf8"));
  console.log(`${((Date.now() - started) / 1000).toFixed(1)}s`);
}

const translations = (await db.query(`select * from bible_translations order by id`)).rows;
const books = (
  await db.query(
    `select id, name, abbreviation, testament, aliases from bible_books order by id`,
  )
).rows;
const verses = (
  await db.query(
    `select translation_id, book_id, chapter, verse, paragraph, text
       from bible_verses order by translation_id, book_id, chapter, verse`,
  )
).rows;

await db.close();

if (books.length !== EXPECTED_BOOKS) {
  console.error(`Expected ${EXPECTED_BOOKS} books, got ${books.length}`);
  process.exit(1);
}
if (verses.length !== EXPECTED_VERSES) {
  console.error(`Expected ${EXPECTED_VERSES} verses, got ${verses.length}`);
  process.exit(1);
}

/**
 * Verses go out as tuples, not objects. At 31,102 rows the difference between
 * ["kjv",43,3,16,1,"..."] and a spelled-out object is several megabytes of
 * repeated key names in a file that ships inside every installer and is parsed
 * on first launch. The reader in desktop/src/main/db/bible.ts names the
 * positions once.
 */
const seed = {
  // Written into the file so a mismatch between a seed and the reader that
  // loads it is caught rather than guessed at.
  format: 1,
  generatedFrom: "supabase/migrations/0020_bible.sql + 0021_bible_kjv_verses.sql",
  translations: translations.map((t) => ({
    id: t.id,
    name: t.name,
    abbreviation: t.abbreviation,
    language_code: t.language_code,
    year: t.year,
    license: t.license,
    source_url: t.source_url,
    is_default: t.is_default ? 1 : 0,
  })),
  books: books.map((b) => ({
    id: b.id,
    name: b.name,
    abbreviation: b.abbreviation,
    testament: b.testament,
    aliases: b.aliases ?? [],
  })),
  /** [translation_id, book_id, chapter, verse, paragraph, text] */
  verses: verses.map((v) => [
    v.translation_id,
    v.book_id,
    v.chapter,
    v.verse,
    v.paragraph ? 1 : 0,
    v.text,
  ]),
};

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, JSON.stringify(seed));

const megabytes = (readFileSync(OUT).length / 1024 / 1024).toFixed(1);
console.log(`\nWrote ${OUT}`);
console.log(
  `  ${seed.translations.length} translation(s), ${seed.books.length} books, ` +
    `${seed.verses.length} verses — ${megabytes} MB`,
);
