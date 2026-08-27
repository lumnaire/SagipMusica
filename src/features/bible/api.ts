import { supabase } from "@/lib/supabase/client";
import type {
  BibleBook,
  BibleChapterInfo,
  BibleSearchHit,
  BibleTranslation,
  BibleVerse,
} from "@/types/bible";
import type { ParsedReference } from "./reference";

/**
 * Reads against the tables from migration 0020.
 *
 * Everything here is a plain PostgREST call — there is no RPC, because there
 * is no query that needs one. Search is a `@@` against the generated tsvector
 * column, which supabase-js expresses directly, and the rest are range scans
 * on the primary key. An RPC would only add a function to keep in step with
 * the client for no gain.
 */

/** The number of verses a single search will return. */
const SEARCH_LIMIT = 100;

/**
 * How many rows to ask for per request when reading something that can be
 * bigger than PostgREST's row cap. See fetchChapterIndex.
 */
const PAGE_SIZE = 1000;

export async function fetchTranslations(): Promise<BibleTranslation[]> {
  const { data, error } = await supabase
    .from("bible_translations")
    .select("*")
    .order("is_default", { ascending: false })
    .order("name");
  if (error) throw error;
  return (data ?? []) as BibleTranslation[];
}

/** All 66, in canonical order. Fetched once and cached — see useBible. */
export async function fetchBooks(): Promise<BibleBook[]> {
  const { data, error } = await supabase
    .from("bible_books")
    .select("*")
    .order("id");
  if (error) throw error;
  return (data ?? []) as BibleBook[];
}

/**
 * Which chapters exist and how many verses each holds — 1,189 rows for the
 * KJV, about 30KB on the wire. Fetched once alongside the books so that every
 * chapter and verse grid in the picker renders instantly and offline
 * thereafter, instead of hitting the database each time somebody changes book.
 *
 * THIS MUST BE PAGED. PostgREST enforces a server-side row cap — 1,000 by
 * default on Supabase — and it applies it *silently*: the request succeeds,
 * `error` is null, and you are handed a prefix of the answer. At 1,189 rows
 * the KJV is just over that line, and because the rows come back in canonical
 * order the part that got dropped was the end of the Bible. The symptom was a
 * picker where John stopped at chapter 3 and Acts through Revelation appeared
 * to have no chapters at all, while the database itself was complete.
 *
 * The loop takes its page size from what the server actually returned rather
 * than from PAGE_SIZE, so a project configured with a lower cap still pages
 * correctly instead of stopping after one short page. `count` gives it a
 * definite target, so a truncated read is impossible rather than merely
 * unlikely.
 */
export async function fetchChapterIndex(translationId: string): Promise<BibleChapterInfo[]> {
  const rows: BibleChapterInfo[] = [];
  let expected: number | null = null;
  let pageSize: number | null = null;

  for (;;) {
    const { data, error, count } = await supabase
      .from("bible_chapters")
      .select("book_id, chapter, verse_count", { count: "exact" })
      .eq("translation_id", translationId)
      .order("book_id")
      .order("chapter")
      .range(rows.length, rows.length + (pageSize ?? PAGE_SIZE) - 1);
    if (error) throw error;

    const page = (data ?? []) as BibleChapterInfo[];
    rows.push(...page);

    if (expected === null && typeof count === "number") expected = count;
    // What the server is willing to give in one response, learned from the
    // first full page rather than assumed.
    if (pageSize === null && page.length > 0) pageSize = page.length;

    // An empty page means there is nothing left, whatever the count claimed.
    if (page.length === 0) break;
    if (expected !== null && rows.length >= expected) break;
    // A short page is the last page.
    if (pageSize !== null && page.length < pageSize) break;
  }

  return rows;
}

/**
 * The verses of a passage, in order.
 *
 * A reference with no chapter ("Philemon") is read as its first chapter, and
 * one with no verses ("Psalm 23") as the whole chapter — both are what the
 * person who typed it meant to see.
 */
export async function fetchPassage(
  translationId: string,
  reference: ParsedReference,
): Promise<BibleVerse[]> {
  const chapter = reference.chapter ?? 1;

  let query = supabase
    .from("bible_verses")
    .select("translation_id, book_id, chapter, verse, text, paragraph")
    .eq("translation_id", translationId)
    .eq("book_id", reference.book.id)
    .eq("chapter", chapter)
    .order("verse");

  if (reference.verseStart !== null) {
    query = query
      .gte("verse", reference.verseStart)
      .lte("verse", reference.verseEnd ?? reference.verseStart);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as BibleVerse[];
}

/**
 * Full-text search over the words of scripture.
 *
 * `websearch` is the tsquery flavour that behaves the way a search box is
 * expected to: bare words are ANDed, "a quoted phrase" is a phrase, and a
 * leading minus excludes. That means a presenter can type
 *
 *     "my shepherd" -want
 *
 * and get what they meant without being taught an operator syntax.
 *
 * Results come back in canonical order rather than by relevance rank. For
 * scripture that is the more useful sort by a distance: somebody scanning for
 * a half-remembered verse knows roughly where in the Bible it lives, and a
 * relevance shuffle that puts Revelation above Genesis destroys that.
 */
export async function searchVerses(
  translationId: string,
  query: string,
  limit = SEARCH_LIMIT,
): Promise<BibleSearchHit[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];

  const { data, error } = await supabase
    .from("bible_verses")
    .select("translation_id, book_id, chapter, verse, text, paragraph, book:bible_books(*)")
    .eq("translation_id", translationId)
    .textSearch("search", trimmed, { type: "websearch", config: "english" })
    .order("book_id")
    .order("chapter")
    .order("verse")
    .limit(limit);
  if (error) throw error;

  return (data ?? []) as unknown as BibleSearchHit[];
}
