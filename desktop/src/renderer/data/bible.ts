import type {
  BibleBook,
  BibleChapterInfo,
  BibleSearchHit,
  BibleTranslation,
  BibleVerse,
} from "@/types/bible";
import type { ParsedReference } from "@/features/bible/reference";
import { invoke } from "./invoke";

/**
 * Desktop stand-in for src/features/bible/api.ts.
 *
 * Aliased over that module at build time, so every exported name and signature
 * here has to match it — the shared picker, the reference parser and the
 * presentation loader are all reused verbatim and must not be able to tell
 * which build they are running in.
 *
 * The differences behind the identical surface:
 *
 *   * No paging. The web version has to page fetchChapterIndex because 1,189
 *     rows is over PostgREST's default cap; SQLite has no such ceiling and no
 *     network to cross, so it comes back in one call.
 *
 *   * No network at all, which is the point. Every one of these answers from
 *     a file on this machine, so scripture works in a building whose internet
 *     is a phone hotspot that dropped out — the case the desktop build exists
 *     for.
 */

/** Matches SEARCH_LIMIT in the web module, so both builds cap the same. */
const SEARCH_LIMIT = 100;

export async function fetchTranslations(): Promise<BibleTranslation[]> {
  return invoke("bible.translations");
}

export async function fetchBooks(): Promise<BibleBook[]> {
  return invoke("bible.books");
}

export async function fetchChapterIndex(translationId: string): Promise<BibleChapterInfo[]> {
  return invoke("bible.chapterIndex", { translationId });
}

/**
 * A reference carries the whole book row, which the main process already has
 * and cannot receive anyway — only structured-cloneable primitives cross IPC
 * cleanly. It is unwrapped to its ids here.
 *
 * A reference with no chapter ("Philemon") is read as its first chapter, as on
 * the web.
 */
export async function fetchPassage(
  translationId: string,
  reference: ParsedReference,
): Promise<BibleVerse[]> {
  return invoke("bible.passage", {
    translationId,
    bookId: reference.book.id,
    chapter: reference.chapter ?? 1,
    verseStart: reference.verseStart,
    verseEnd: reference.verseEnd,
  });
}

export async function searchVerses(
  translationId: string,
  query: string,
  limit = SEARCH_LIMIT,
): Promise<BibleSearchHit[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];
  return invoke("bible.search", { translationId, query: trimmed, limit });
}
