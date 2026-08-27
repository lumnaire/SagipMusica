import { create } from "zustand";
import { fetchBooks, fetchChapterIndex, fetchTranslations } from "@/features/bible/api";
import { buildBookIndex } from "@/features/bible/reference";
import type { BibleBook, BibleTranslation } from "@/types/bible";

/**
 * The parts of the Bible that never change, held for the session.
 *
 * 66 books and 1,189 chapter rows, about 40KB, fetched once the first time
 * anything asks. After that every chapter grid, every verse grid and every
 * reference the user types is answered from memory — no round trip, and none
 * of it stops working when the building's internet does. Only the verse text
 * itself is fetched on demand, and only for the passage being looked at.
 *
 * Loading is idempotent and concurrent-safe: `inFlight` means two components
 * mounting at once share one request rather than racing two.
 */
interface BibleState {
  status: "idle" | "loading" | "ready" | "error";
  error: string | null;

  translations: BibleTranslation[];
  /** The translation everything reads from. Defaults to the seeded default. */
  translationId: string;

  books: BibleBook[];
  /** Every spelling of every book, for parseReference. */
  bookIndex: Map<string, BibleBook>;
  /**
   * book id -> verse count per chapter, indexed from zero. So
   * `chapters.get(43)!.length` is how many chapters John has, and
   * `chapters.get(43)![2]` is how many verses are in John 3.
   */
  chapters: Map<number, number[]>;

  load: () => Promise<void>;
  setTranslationId: (id: string) => Promise<void>;
}

let inFlight: Promise<void> | null = null;

export const useBibleStore = create<BibleState>((set, get) => ({
  status: "idle",
  error: null,
  translations: [],
  translationId: "kjv",
  books: [],
  bookIndex: new Map(),
  chapters: new Map(),

  load: async () => {
    if (get().status === "ready") return;
    if (inFlight) return inFlight;

    set({ status: "loading", error: null });

    inFlight = (async () => {
      try {
        const [translations, books] = await Promise.all([fetchTranslations(), fetchBooks()]);

        const translationId =
          translations.find((t) => t.is_default)?.id ?? translations[0]?.id ?? "kjv";

        const chapterRows = await fetchChapterIndex(translationId);

        set({
          status: "ready",
          translations,
          translationId,
          books,
          bookIndex: buildBookIndex(books),
          chapters: groupChapters(chapterRows),
        });
      } catch (err) {
        set({
          status: "error",
          error: err instanceof Error ? err.message : "Failed to load the Bible.",
        });
      } finally {
        inFlight = null;
      }
    })();

    return inFlight;
  },

  setTranslationId: async (id) => {
    if (id === get().translationId) return;
    // Chapter and verse counts are per-translation — a translation with a
    // different versification would have different grids — so they are
    // refetched rather than reused.
    const chapterRows = await fetchChapterIndex(id);
    set({ translationId: id, chapters: groupChapters(chapterRows) });
  },
}));

function groupChapters(rows: { book_id: number; chapter: number; verse_count: number }[]) {
  const chapters = new Map<number, number[]>();
  for (const row of rows) {
    const counts = chapters.get(row.book_id) ?? [];
    counts[row.chapter - 1] = row.verse_count;
    chapters.set(row.book_id, counts);
  }
  return chapters;
}
