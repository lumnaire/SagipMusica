import { readFileSync } from "node:fs";
import type { Db } from "./connection";

/** Tuple layout written by scripts/build-bible-seed.mjs. */
type SeedVerse = [
  translationId: string,
  bookId: number,
  chapter: number,
  verse: number,
  paragraph: 0 | 1,
  text: string,
];

interface SeedFile {
  format: number;
  translations: {
    id: string;
    name: string;
    abbreviation: string;
    language_code: string;
    year: number | null;
    license: string;
    source_url: string | null;
    is_default: 0 | 1;
  }[];
  books: {
    id: number;
    name: string;
    abbreviation: string;
    testament: string;
    aliases: string[];
  }[];
  verses: SeedVerse[];
}

/** Bumped only if the tuple layout above changes. */
const SUPPORTED_FORMAT = 1;

/** The canonical Protestant count. A short load is a broken install. */
const EXPECTED_VERSES = 31102;

/**
 * Loads the Bible into SQLite on first launch.
 *
 * Separate from seedIfEmpty and separately guarded: the hymnal seed decides it
 * has already run by looking for a church row, which says nothing about
 * whether scripture is present. An install upgraded from 1.0.x has a church
 * and no Bible, and this is the path that gives it one.
 *
 * The whole load is one transaction. 31,102 verses committed individually
 * would mean 31,102 fsyncs and a first launch measured in minutes; inside a
 * transaction it is a couple of seconds, and — more importantly — a crash
 * halfway through leaves no Bible at all rather than half of one that every
 * later launch would consider "already seeded".
 *
 * Returns true if it loaded anything.
 */
export function seedBibleIfEmpty(db: Db, seedPath: string): boolean {
  const existing = db.prepare("select count(*) as n from bible_verses").get() as { n: number };
  if (existing.n > 0) return false;

  const seed = JSON.parse(readFileSync(seedPath, "utf8")) as SeedFile;

  if (seed.format !== SUPPORTED_FORMAT) {
    throw new Error(
      `bible-seed.json is format ${seed.format}, this build reads ${SUPPORTED_FORMAT}. ` +
        `Re-run "npm run bible:seed" from the repository root.`,
    );
  }
  if (seed.verses.length !== EXPECTED_VERSES) {
    throw new Error(
      `bible-seed.json holds ${seed.verses.length} verses, expected ${EXPECTED_VERSES}.`,
    );
  }

  const insertTranslation = db.prepare(
    `insert into bible_translations
       (id, name, abbreviation, language_code, year, license, source_url, is_default)
     values (?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  const insertBook = db.prepare(
    `insert into bible_books (id, name, abbreviation, testament, aliases)
     values (?, ?, ?, ?, ?)`,
  );
  const insertVerse = db.prepare(
    `insert into bible_verses (translation_id, book_id, chapter, verse, paragraph, text)
     values (?, ?, ?, ?, ?, ?)`,
  );

  db.transaction(() => {
    for (const t of seed.translations) {
      insertTranslation.run(
        t.id,
        t.name,
        t.abbreviation,
        t.language_code,
        t.year,
        t.license,
        t.source_url,
        t.is_default,
      );
    }

    for (const b of seed.books) {
      insertBook.run(b.id, b.name, b.abbreviation, b.testament, JSON.stringify(b.aliases));
    }

    for (const [translationId, bookId, chapter, verse, paragraph, text] of seed.verses) {
      insertVerse.run(translationId, bookId, chapter, verse, paragraph, text);
    }

    // Build the search index from the rows just written. Doing it once here,
    // rather than maintaining it with triggers, is what lets the schema skip
    // the usual external-content trigger set — see bible-schema.sql.
    db.prepare(`insert into bible_verses_fts(bible_verses_fts) values('rebuild')`).run();
  })();

  // A half-loaded Bible is worse than none: it looks fine until the Sunday
  // somebody turns to the part that is missing.
  const loaded = db.prepare("select count(*) as n from bible_verses").get() as { n: number };
  if (loaded.n !== EXPECTED_VERSES) {
    throw new Error(`Bible load is incomplete: ${loaded.n} of ${EXPECTED_VERSES} verses.`);
  }

  return true;
}
