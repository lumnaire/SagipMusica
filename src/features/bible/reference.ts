/**
 * Turning what somebody types into a passage.
 *
 * The one input on the Bible picker does double duty: type a reference and it
 * jumps there, type words and it searches. Telling those apart is this file's
 * job, and it has to be generous about it, because the person typing is
 * usually standing at the back of a room with a service already running. All
 * of these mean John 3:16 —
 *
 *   John 3:16   john 3:16   Jn 3.16   JOHN 3 16   jhn3:16
 *
 * and all of these mean the same passage in First John —
 *
 *   1 John 4:7   1jn 4:7   I John 4:7   first john 4:7
 *
 * This runs entirely on the client. The book list it matches against is 66
 * rows fetched once (see api.ts), so resolving a reference costs nothing and
 * happens on every keystroke without a round trip. It is also why the aliases
 * live in the database rather than in this file: the desktop build will parse
 * references against the same rows.
 *
 * Deliberately NOT supported, because each one costs more than it is worth
 * until somebody asks:
 *
 *   - Ranges that cross a chapter ("John 3:16-4:2"). Parsed as far as the
 *     first chapter and the tail ignored, rather than rejected.
 *   - Discrete lists ("John 3:16,18"). The comma is treated as the end of the
 *     reference.
 */
import type { BibleBook } from "@/types/bible";

export interface ParsedReference {
  book: BibleBook;
  /** Null when only a book was named — "Philemon", "Jude". */
  chapter: number | null;
  /** Null when only a chapter was named — the whole chapter is the passage. */
  verseStart: number | null;
  /** Equal to verseStart for a single verse. Null when verseStart is null. */
  verseEnd: number | null;
}

/**
 * Reduces a book name to the form used as a lookup key: lower case, no
 * punctuation, no spaces, and a leading ordinal spelled as a digit.
 *
 * The ordinal rules all require a separator after the numeral, which is what
 * keeps "Isaiah" from being read as "I saiah" and "Iii"-style input working at
 * the same time. Rules are applied longest-first so "iii" is never consumed as
 * "ii" plus a stray "i".
 */
export function normalizeBookToken(raw: string): string {
  const lowered = raw.toLowerCase().trim();

  const ordinal = lowered
    .replace(/^(?:iii|3rd|third)\s+/, "3 ")
    .replace(/^(?:ii|2nd|second)\s+/, "2 ")
    .replace(/^(?:i|1st|first)\s+/, "1 ");

  return ordinal.replace(/[^a-z0-9]/g, "");
}

/**
 * Every spelling of every book, mapped to the book. Built once from the rows
 * and handed back to the parser, so a 66-row scan does not happen per
 * keystroke.
 */
export function buildBookIndex(books: BibleBook[]): Map<string, BibleBook> {
  const index = new Map<string, BibleBook>();

  for (const book of books) {
    for (const spelling of [book.name, book.abbreviation, ...book.aliases]) {
      const token = normalizeBookToken(spelling);
      // First writer wins. The migration guarantees no two books share a
      // token, so this only ever collapses a book's own duplicates — the
      // several books whose abbreviation is their name.
      if (token && !index.has(token)) index.set(token, book);
    }
  }

  return index;
}

/**
 * Splits "1 John 4:7-8" into its book part and its numbers.
 *
 * `(.+?)` is lazy, so on "1 John 4" it first tries the book part "1" and only
 * grows it once "John" fails to be a chapter number. That backtracking is what
 * lets books whose names start with a digit work without a special case.
 *
 * Chapter and verse may be separated by a colon, a period or plain space, and
 * a range by any of the three dashes people actually produce.
 */
const REFERENCE = /^(.+?)[\s.]*(\d+)(?:\s*[:.\s]\s*(\d+)(?:\s*[-–—]\s*(\d+))?)?\s*$/;

export function parseReference(
  input: string,
  index: Map<string, BibleBook>,
): ParsedReference | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  // A bare book name: "Jude", "song of songs". Tried first because the
  // reference pattern below requires a number and would reject it.
  const bare = index.get(normalizeBookToken(trimmed));
  if (bare) return { book: bare, chapter: null, verseStart: null, verseEnd: null };

  const match = REFERENCE.exec(trimmed);
  if (!match) return null;

  const [, bookPart, chapterPart, startPart, endPart] = match;

  const book = index.get(normalizeBookToken(bookPart));
  if (!book) return null;

  const chapter = Number(chapterPart);
  if (!Number.isInteger(chapter) || chapter < 1) return null;

  if (startPart === undefined) {
    return { book, chapter, verseStart: null, verseEnd: null };
  }

  const verseStart = Number(startPart);
  if (!Number.isInteger(verseStart) || verseStart < 1) return null;

  // "John 3:18-16" is a slip, not a request for a backwards passage. Reading
  // it as the single verse the person started with beats showing nothing.
  const verseEnd = endPart === undefined ? verseStart : Number(endPart);

  return {
    book,
    chapter,
    verseStart,
    verseEnd: verseEnd >= verseStart ? verseEnd : verseStart,
  };
}

/**
 * The passage written the way it is cited: "John 3:16", "John 3:16-18",
 * "Psalms 23", "Jude". This is what goes on the slide and in the presenter's
 * list, so it uses the book's full name rather than its abbreviation.
 */
export function formatReference(reference: ParsedReference): string {
  const { book, chapter, verseStart, verseEnd } = reference;

  if (chapter === null) return book.name;
  if (verseStart === null) return `${book.name} ${chapter}`;
  if (verseEnd === null || verseEnd === verseStart) {
    return `${book.name} ${chapter}:${verseStart}`;
  }
  return `${book.name} ${chapter}:${verseStart}-${verseEnd}`;
}

/**
 * The same passage in the compact form used in a URL, so a presentation can be
 * linked to: `/presentation/<id>?type=scripture&ref=43.3.16-18`.
 *
 * Book id rather than name on purpose — it is short, it cannot be misspelled,
 * and it does not need escaping.
 */
export function encodeReference(reference: ParsedReference): string {
  const { book, chapter, verseStart, verseEnd } = reference;
  if (chapter === null) return String(book.id);
  if (verseStart === null) return `${book.id}.${chapter}`;
  if (verseEnd === null || verseEnd === verseStart) {
    return `${book.id}.${chapter}.${verseStart}`;
  }
  return `${book.id}.${chapter}.${verseStart}-${verseEnd}`;
}

/** Inverse of encodeReference. Returns null on anything it did not write. */
export function decodeReference(
  encoded: string,
  books: BibleBook[],
): ParsedReference | null {
  const match = /^(\d+)(?:\.(\d+)(?:\.(\d+)(?:-(\d+))?)?)?$/.exec(encoded.trim());
  if (!match) return null;

  const book = books.find((b) => b.id === Number(match[1]));
  if (!book) return null;

  const chapter = match[2] === undefined ? null : Number(match[2]);
  const verseStart = match[3] === undefined ? null : Number(match[3]);
  const verseEnd = match[4] === undefined ? verseStart : Number(match[4]);

  return { book, chapter, verseStart, verseEnd };
}
