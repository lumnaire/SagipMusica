import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useBibleStore } from "@/stores/bible-store";
import { BibleBrowser } from "./BibleBrowser";
import type { BibleBook } from "@/types/bible";

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

// vi.mock factories are hoisted above the module body, so the fixtures they
// close over have to be hoisted with them.
const { BOOKS, JOHN_3, TRANSLATION, CHAPTER_INDEX } = vi.hoisted(() => {
  const books: BibleBook[] = [
    { id: 19, name: "Psalms", abbreviation: "Ps", testament: "old", aliases: ["psalm"] },
    { id: 43, name: "John", abbreviation: "John", testament: "new", aliases: ["jn"] },
  ];

  return {
    BOOKS: books,
    JOHN_3: Array.from({ length: 18 }, (_, i) => ({
      translation_id: "kjv",
      book_id: 43,
      chapter: 3,
      verse: i + 1,
      text: i + 1 === 16 ? "For God so loved the world…" : `John three verse ${i + 1}.`,
      paragraph: false,
    })),
    TRANSLATION: {
      id: "kjv",
      name: "King James Version",
      abbreviation: "KJV",
      language_code: "en",
      year: 1769,
      license: "Public domain.",
      source_url: null,
      is_default: true,
    },
    CHAPTER_INDEX: [
      { book_id: 43, chapter: 1, verse_count: 51 },
      { book_id: 43, chapter: 2, verse_count: 25 },
      { book_id: 43, chapter: 3, verse_count: 36 },
      { book_id: 19, chapter: 23, verse_count: 6 },
    ],
  };
});

vi.mock("@/features/bible/api", () => ({
  fetchBooks: vi.fn().mockResolvedValue(BOOKS),
  fetchTranslations: vi.fn().mockResolvedValue([TRANSLATION]),
  fetchChapterIndex: vi.fn().mockResolvedValue(CHAPTER_INDEX),
  fetchPassage: vi.fn().mockResolvedValue(JOHN_3),
  searchVerses: vi.fn().mockResolvedValue([{ ...JOHN_3[15], book: BOOKS[1] }]),
}));

function resetStore() {
  useBibleStore.setState({
    status: "idle",
    error: null,
    translations: [],
    translationId: "kjv",
    books: [],
    bookIndex: new Map(),
    chapters: new Map(),
  });
}

describe("BibleBrowser", () => {
  beforeEach(() => {
    resetStore();
    vi.clearAllMocks();
  });

  it("lists the books once the Bible has loaded", async () => {
    render(<BibleBrowser onPresent={vi.fn()} />);

    expect(await screen.findByRole("button", { name: "John" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Psalms" })).toBeInTheDocument();
    expect(screen.getByText("Old Testament")).toBeInTheDocument();
  });

  it("jumps to a typed reference and selects the verse", async () => {
    const user = userEvent.setup();
    const onPresent = vi.fn();
    render(<BibleBrowser onPresent={onPresent} />);

    await screen.findByRole("button", { name: "John" });
    await user.type(screen.getByPlaceholderText(/type a reference/i), "jn 3:16");

    // The abbreviation resolves, the chapter loads, and the passage the
    // buttons act on is the single verse that was named.
    await waitFor(() => expect(screen.getByText("John 3:16")).toBeInTheDocument());

    await user.click(screen.getByRole("button", { name: /^present$/i }));

    expect(onPresent).toHaveBeenCalledTimes(1);
    const reference = onPresent.mock.calls[0][0];
    expect(reference.book.name).toBe("John");
    expect(reference.chapter).toBe(3);
    expect(reference.verseStart).toBe(16);
    expect(reference.verseEnd).toBe(16);
  });

  it("searches the text when the input is not a reference", async () => {
    const user = userEvent.setup();
    const api = await import("@/features/bible/api");
    render(<BibleBrowser onPresent={vi.fn()} />);

    await screen.findByRole("button", { name: "John" });
    await user.type(screen.getByPlaceholderText(/type a reference/i), "so loved the world");

    await waitFor(() => expect(api.searchVerses).toHaveBeenCalled());
    expect(await screen.findByText("John 3:16")).toBeInTheDocument();
  });

  it("offers to add to a running presentation only when it can", async () => {
    const { unmount } = render(<BibleBrowser onPresent={vi.fn()} />);
    await screen.findByRole("button", { name: "John" });
    expect(screen.queryByRole("button", { name: /add to presentation/i })).not.toBeInTheDocument();
    unmount();

    render(<BibleBrowser onPresent={vi.fn()} onAdd={vi.fn()} />);
    await screen.findByRole("button", { name: "John" });
    expect(screen.getByRole("button", { name: /add to presentation/i })).toBeInTheDocument();
  });
});
