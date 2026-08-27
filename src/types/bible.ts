/**
 * Scripture, as it comes out of the tables added in migration 0020.
 *
 * These mirror the database rows exactly, snake_case included, because they
 * are what PostgREST hands back and translating them would only create a
 * second vocabulary for the same thing.
 */

export type Testament = "old" | "new";

export interface BibleTranslation {
  id: string;
  name: string;
  /** Printed under the reference on the projector: "John 3:16 (KJV)". */
  abbreviation: string;
  language_code: string;
  /** The year of this revision — 1769 for the KJV, not 1611. */
  year: number | null;
  license: string;
  source_url: string | null;
  is_default: boolean;
}

export interface BibleBook {
  /** 1 = Genesis … 66 = Revelation. Also the canonical sort order. */
  id: number;
  name: string;
  abbreviation: string;
  testament: Testament;
  /** Other spellings this book answers to. See parseReference. */
  aliases: string[];
}

export interface BibleVerse {
  translation_id: string;
  book_id: number;
  chapter: number;
  verse: number;
  text: string;
  /** True where the printed edition begins a paragraph. Not rendered yet. */
  paragraph: boolean;
}

/** One row of the `bible_chapters` view: which chapters exist, and how long. */
export interface BibleChapterInfo {
  book_id: number;
  chapter: number;
  verse_count: number;
}

/** A verse with its book resolved, which is what every list in the UI shows. */
export interface BibleSearchHit extends BibleVerse {
  book: BibleBook;
}
