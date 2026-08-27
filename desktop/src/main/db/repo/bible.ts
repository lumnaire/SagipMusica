import type {
  BibleBook,
  BibleChapterInfo,
  BibleSearchHit,
  BibleTranslation,
  BibleVerse,
} from "@/types/bible";
import { getDb } from "../connection";

/**
 * Reads of scripture, mirroring src/features/bible/api.ts one function at a
 * time so the shared picker cannot tell which build it is running on.
 *
 * Reads only. Nothing here writes, and there is no write operation in the IPC
 * allowlist, so the renderer has no way to alter a verse — the same guarantee
 * the hosted app gets from having a select policy and no others.
 *
 * SQLite has neither booleans nor arrays, so every function below converts on
 * the way out: `paragraph` and `is_default` come back as 0/1 and leave as
 * booleans, and `aliases` is JSON text that leaves as a string[]. Handing the
 * renderer a 0 where the web hands it `false` would be the kind of difference
 * that only shows up in a `=== true` somewhere months later.
 */

interface BookRow {
  id: number;
  name: string;
  abbreviation: string;
  testament: string;
  aliases: string;
}

interface VerseRow {
  translation_id: string;
  book_id: number;
  chapter: number;
  verse: number;
  text: string;
  paragraph: number;
}

function toBook(row: BookRow): BibleBook {
  return {
    id: row.id,
    name: row.name,
    abbreviation: row.abbreviation,
    testament: row.testament as BibleBook["testament"],
    aliases: JSON.parse(row.aliases) as string[],
  };
}

function toVerse(row: VerseRow): BibleVerse {
  return {
    translation_id: row.translation_id,
    book_id: row.book_id,
    chapter: row.chapter,
    verse: row.verse,
    text: row.text,
    paragraph: row.paragraph === 1,
  };
}

const VERSE_COLUMNS = `translation_id, book_id, chapter, verse, text, paragraph`;

export function translations(): BibleTranslation[] {
  const rows = getDb()
    .prepare(
      `select id, name, abbreviation, language_code, year, license, source_url, is_default
         from bible_translations order by is_default desc, name`,
    )
    .all() as (Omit<BibleTranslation, "is_default"> & { is_default: number })[];

  return rows.map((row) => ({ ...row, is_default: row.is_default === 1 }));
}

export function books(): BibleBook[] {
  const rows = getDb()
    .prepare(`select id, name, abbreviation, testament, aliases from bible_books order by id`)
    .all() as BookRow[];

  return rows.map(toBook);
}

/**
 * Which chapters exist and how many verses each holds.
 *
 * Returns every row in one go, with no paging to think about: there is no
 * PostgREST in the way and no network, just a local aggregate over a file.
 * (The web client has to page the same query — 1,189 rows is over PostgREST's
 * default cap. See fetchChapterIndex.)
 */
export function chapterIndex(translationId: string): BibleChapterInfo[] {
  return getDb()
    .prepare(
      `select book_id, chapter, count(*) as verse_count
         from bible_verses where translation_id = ?
        group by book_id, chapter
        order by book_id, chapter`,
    )
    .all(translationId) as BibleChapterInfo[];
}

export function passage(args: {
  translationId: string;
  bookId: number;
  chapter: number;
  verseStart: number | null;
  verseEnd: number | null;
}): BibleVerse[] {
  const { translationId, bookId, chapter, verseStart, verseEnd } = args;

  const rows =
    verseStart === null
      ? (getDb()
          .prepare(
            `select ${VERSE_COLUMNS} from bible_verses
              where translation_id = ? and book_id = ? and chapter = ?
              order by verse`,
          )
          .all(translationId, bookId, chapter) as VerseRow[])
      : (getDb()
          .prepare(
            `select ${VERSE_COLUMNS} from bible_verses
              where translation_id = ? and book_id = ? and chapter = ?
                and verse between ? and ?
              order by verse`,
          )
          .all(translationId, bookId, chapter, verseStart, verseEnd ?? verseStart) as VerseRow[]);

  return rows.map(toVerse);
}

/**
 * Translates what somebody typed into an FTS5 query.
 *
 * The hosted app hands the raw string to `websearch_to_tsquery`, which is
 * generous about it: bare words are ANDed, "a quoted phrase" stays a phrase,
 * and a leading minus excludes. FTS5 has the same capabilities under a
 * different syntax and none of the tolerance — an unbalanced quote or a stray
 * `*` is a hard error, not a shrug — so the string is taken apart and rebuilt
 * rather than passed through.
 *
 * Every term goes back in double-quoted. That is not only escaping: a
 * double-quoted token in FTS5 is a literal phrase, so the whole zoo of query
 * operators somebody might type by accident (`*`, `^`, `:`, `NEAR`, `AND`) is
 * inert. Whatever they typed is searched for as words.
 *
 * Returns null when nothing searchable is left, so the caller can return no
 * results rather than send FTS5 an empty query, which is an error.
 */
export function buildFtsQuery(input: string): string | null {
  const quote = (term: string) => `"${term.replace(/"/g, '""')}"`;

  const include: string[] = [];
  const exclude: string[] = [];

  // Quoted phrases first, so their inner spaces survive the word split below.
  const withoutPhrases = input.replace(
    /(-?)"([^"]*)"/g,
    (_match, negated: string, phrase: string) => {
      const cleaned = phrase.trim();
      if (cleaned) (negated ? exclude : include).push(quote(cleaned));
      return " ";
    },
  );

  for (const word of withoutPhrases.split(/\s+/)) {
    const negated = word.startsWith("-");
    // Apostrophes are kept: the KJV is full of them, and "thou'rt" should
    // search as it was typed.
    const cleaned = (negated ? word.slice(1) : word).replace(/[^\p{L}\p{N}']/gu, "");
    if (cleaned) (negated ? exclude : include).push(quote(cleaned));
  }

  if (include.length === 0) return null;

  const positive = include.join(" AND ");
  // FTS5's NOT is binary — `a NOT b` — so the positives are grouped to stop it
  // binding to only the last term of a multi-word query.
  return exclude.length > 0 ? `(${positive}) NOT (${exclude.join(" OR ")})` : positive;
}

interface SearchRow extends VerseRow {
  b_id: number;
  b_name: string;
  b_abbreviation: string;
  b_testament: string;
  b_aliases: string;
}

/**
 * Results come back in canonical order rather than by relevance, matching the
 * hosted app: somebody scanning for a half-remembered verse knows roughly
 * where in the Bible it lives, and a relevance shuffle destroys that.
 */
export function search(args: {
  translationId: string;
  query: string;
  limit: number;
}): BibleSearchHit[] {
  const match = buildFtsQuery(args.query);
  if (!match) return [];

  const rows = getDb()
    .prepare(
      `select v.translation_id, v.book_id, v.chapter, v.verse, v.text, v.paragraph,
              b.id as b_id, b.name as b_name, b.abbreviation as b_abbreviation,
              b.testament as b_testament, b.aliases as b_aliases
         from bible_verses_fts f
         join bible_verses v on v.rowid = f.rowid
         join bible_books b on b.id = v.book_id
        where f.text match ? and v.translation_id = ?
        order by v.book_id, v.chapter, v.verse
        limit ?`,
    )
    .all(match, args.translationId, args.limit) as SearchRow[];

  return rows.map((row) => ({
    ...toVerse(row),
    book: toBook({
      id: row.b_id,
      name: row.b_name,
      abbreviation: row.b_abbreviation,
      testament: row.b_testament,
      aliases: row.b_aliases,
    }),
  }));
}
