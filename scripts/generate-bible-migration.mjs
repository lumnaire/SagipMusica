// Generates supabase/migrations/0021_bible_kjv_verses.sql from the 1769
// Authorized Version.
//
//   node scripts/generate-bible-migration.mjs [path/to/verses-1769.json]
//
// With no argument the source is downloaded once to scripts/out/ (gitignored)
// and reused on later runs. The output is deterministic: same input, byte-identical
// SQL, so re-running it produces no diff unless the transformations below change.
//
// Only the VERSES are generated here. The schema, the 66 book rows and the
// translation row are hand-written in 0020_bible.sql -- that part is read by
// people and changed by hand, and it has no business being regenerated.
//
// ---------------------------------------------------------------------------
// Source
// ---------------------------------------------------------------------------
//
// farskipper/kjv, json/verses-1769.json. Public domain: the 1769 Blayney
// revision of the 1611 Authorized Version is out of copyright everywhere,
// including under the UK Crown's perpetual letters patent, which only ever
// restricted printing within the United Kingdom.
//
// Shape is one flat object of "Book Chapter:Verse" -> text:
//
//   { "Genesis 1:1": "In the beginning God created the heaven and the earth.", ... }
//
// 31,102 verses across 66 books, which is the canonical Protestant count, and
// pure ASCII throughout. The script asserts both rather than trusting them.
//
// ---------------------------------------------------------------------------
// Transformations
// ---------------------------------------------------------------------------
//
// Two, both applied to make the stored text projection-ready, because every
// consumer we have or plan -- the projector canvas, the presenter's list, the
// full-text index, the desktop app -- wants exactly the same clean string:
//
//  1. PARAGRAPH MARKS. The source prefixes 2,936 verses with "# ", standing in
//     for the pilcrow the printed KJV puts at the start of a paragraph. The
//     marker is stripped from the text and kept as bible_verses.paragraph, so
//     the information survives without every reader having to strip a "#".
//
//  2. ITALICS. The source brackets the words the 1611 translators supplied
//     that have no counterpart in the Hebrew or Greek -- "the LORD [was] with
//     Joseph" -- which print editions set in italics. 14,233 verses carry
//     them. The brackets are REMOVED, not stored: on a sanctuary screen they
//     read as a typo, and no part of this product renders them. Delete the
//     stripping below and re-run if that ever changes.
//
// Nothing else is touched. No spelling is modernised, no punctuation is
// normalised, and the verse divisions are the source's.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const CACHE = resolve(ROOT, "scripts/out/verses-1769.json");
const OUT = resolve(ROOT, "supabase/migrations/0021_bible_kjv_verses.sql");

const SOURCE_URL =
  "https://raw.githubusercontent.com/farskipper/kjv/master/json/verses-1769.json";

/** Matches bible_translations.id seeded by 0020_bible.sql. */
const TRANSLATION_ID = "kjv";

/** Rows per INSERT. Small enough to keep any one statement parseable. */
const BATCH = 400;

const EXPECTED_VERSES = 31102;

/**
 * Canonical order, 1-66, and the book_id every verse row points at. The names
 * on the left are the source file's, which differ from ours in exactly one
 * place -- it calls the 22nd book "Solomon's Song" -- so the map is also what
 * proves the source has the books we think it has and no others.
 *
 * These ids MUST agree with the bible_books seed in 0020_bible.sql.
 */
const BOOK_IDS = new Map(
  [
    "Genesis", "Exodus", "Leviticus", "Numbers", "Deuteronomy",
    "Joshua", "Judges", "Ruth", "1 Samuel", "2 Samuel",
    "1 Kings", "2 Kings", "1 Chronicles", "2 Chronicles", "Ezra",
    "Nehemiah", "Esther", "Job", "Psalms", "Proverbs",
    "Ecclesiastes", "Solomon's Song", "Isaiah", "Jeremiah", "Lamentations",
    "Ezekiel", "Daniel", "Hosea", "Joel", "Amos",
    "Obadiah", "Jonah", "Micah", "Nahum", "Habakkuk",
    "Zephaniah", "Haggai", "Zechariah", "Malachi", "Matthew",
    "Mark", "Luke", "John", "Acts", "Romans",
    "1 Corinthians", "2 Corinthians", "Galatians", "Ephesians", "Philippians",
    "Colossians", "1 Thessalonians", "2 Thessalonians", "1 Timothy", "2 Timothy",
    "Titus", "Philemon", "Hebrews", "James", "1 Peter",
    "2 Peter", "1 John", "2 John", "3 John", "Jude",
    "Revelation",
  ].map((name, i) => [name, i + 1]),
);

function fail(message) {
  console.error(`generate-bible-migration: ${message}`);
  process.exit(1);
}

async function loadSource() {
  const explicit = process.argv[2];
  if (explicit) return JSON.parse(readFileSync(resolve(explicit), "utf8"));

  if (!existsSync(CACHE)) {
    console.log(`Downloading ${SOURCE_URL}`);
    const response = await fetch(SOURCE_URL);
    if (!response.ok) fail(`download failed: HTTP ${response.status}`);
    mkdirSync(dirname(CACHE), { recursive: true });
    writeFileSync(CACHE, await response.text());
  }
  return JSON.parse(readFileSync(CACHE, "utf8"));
}

/**
 * Postgres E'' string body. The source is ASCII with no backslashes, which is
 * asserted before we get here, so a single quote is the only thing to double
 * -- but the backslash case is handled anyway rather than left as a landmine
 * for whoever swaps in a different translation.
 */
function sqlText(value) {
  return `E'${value.replace(/\\/g, "\\\\").replace(/'/g, "''")}'`;
}

const verses = await loadSource();
const keys = Object.keys(verses);

if (keys.length !== EXPECTED_VERSES) {
  fail(`expected ${EXPECTED_VERSES} verses, source has ${keys.length}`);
}

/** @type {{bookId:number,chapter:number,verse:number,paragraph:boolean,text:string}[]} */
const rows = [];
/** book_id -> chapter -> highest verse seen, used for the counts assertion below. */
const shape = new Map();

for (const key of keys) {
  const match = /^(.+) (\d+):(\d+)$/.exec(key);
  if (!match) fail(`unparseable reference: ${key}`);

  const [, book, chapter, verse] = match;
  const bookId = BOOK_IDS.get(book);
  if (!bookId) fail(`unknown book: ${book}`);

  let text = verses[key];
  if (!/^[\x20-\x7e]*$/.test(text)) fail(`non-ASCII text at ${key}`);

  // 1. Paragraph marks.
  const paragraph = text.startsWith("# ");
  if (paragraph) text = text.slice(2);

  // 2. Italics. Brackets always balance in this source -- asserted here so a
  //    replacement source that nests or leaves one open is caught rather than
  //    silently producing text with a stray bracket in it.
  if ((text.match(/\[/g) ?? []).length !== (text.match(/\]/g) ?? []).length) {
    fail(`unbalanced italic brackets at ${key}`);
  }
  text = text.replace(/[[\]]/g, "");

  text = text.trim();
  if (text.length === 0) fail(`empty verse at ${key}`);

  rows.push({ bookId, chapter: Number(chapter), verse: Number(verse), paragraph, text });

  const chapters = shape.get(bookId) ?? new Map();
  chapters.set(Number(chapter), Math.max(chapters.get(Number(chapter)) ?? 0, Number(verse)));
  shape.set(bookId, chapters);
}

if (shape.size !== 66) fail(`expected 66 books, source has ${shape.size}`);

// Every chapter runs 1..n with no gaps, and so does every book's chapters.
// A hole here would show up in the app as a verse that cannot be projected,
// which is the kind of thing you want to hear about now and not on a Sunday.
for (const [bookId, chapters] of shape) {
  for (let c = 1; c <= chapters.size; c += 1) {
    if (!chapters.has(c)) fail(`book ${bookId} is missing chapter ${c}`);
  }
  const seen = new Set(rows.filter((r) => r.bookId === bookId).map((r) => `${r.chapter}:${r.verse}`));
  for (const [chapter, last] of chapters) {
    for (let v = 1; v <= last; v += 1) {
      if (!seen.has(`${chapter}:${v}`)) fail(`book ${bookId} ${chapter} is missing verse ${v}`);
    }
  }
}

// Canonical order: sorting by (book, chapter, verse) means the INSERTs land in
// reading order, which keeps the physical row order close to the order the app
// scans a chapter in, and makes the generated file diffable.
rows.sort((a, b) => a.bookId - b.bookId || a.chapter - b.chapter || a.verse - b.verse);

const paragraphs = rows.filter((r) => r.paragraph).length;

const out = [];
out.push(`-- The King James Version (1769 Blayney revision): ${rows.length} verses.
--
-- GENERATED by scripts/generate-bible-migration.mjs -- do not hand-edit.
-- Change the script and re-run it instead; the output is reproducible.
--
-- Source: farskipper/kjv, json/verses-1769.json. Public domain.
--
-- ${paragraphs} verses begin a paragraph in the printed text and are marked as
-- such. The italic brackets the source uses for words supplied by the
-- translators have been removed -- see the script's header for why, and for
-- what to change if they should be kept.
--
-- The schema, the translation row and the 66 book rows are in 0020_bible.sql.
-- This file only fills in bible_verses, and it is idempotent: re-running it
-- replaces the KJV text and nothing else.

delete from bible_verses where translation_id = '${TRANSLATION_ID}';
`);

for (let i = 0; i < rows.length; i += BATCH) {
  const batch = rows.slice(i, i + BATCH);
  out.push(
    `insert into bible_verses (translation_id, book_id, chapter, verse, paragraph, text)\nvalues\n` +
      batch
        .map(
          (r) =>
            `  ('${TRANSLATION_ID}', ${r.bookId}, ${r.chapter}, ${r.verse}, ${r.paragraph}, ${sqlText(r.text)})`,
        )
        .join(",\n") +
      ";\n",
  );
}

// A migration that silently inserted 30,000 verses would leave the app looking
// fine until somebody turned to the chapter that was missing. Fail the
// migration instead.
out.push(`-- Refuse to leave a partial Bible behind.
do $$
declare
  n integer;
begin
  select count(*) into n from bible_verses where translation_id = '${TRANSLATION_ID}';
  if n <> ${rows.length} then
    raise exception 'KJV import is incomplete: expected ${rows.length} verses, found %', n;
  end if;
end $$;
`);

writeFileSync(OUT, out.join("\n"));

console.log(`Wrote ${OUT}`);
console.log(`  ${rows.length} verses, ${shape.size} books, ${paragraphs} paragraph starts`);
