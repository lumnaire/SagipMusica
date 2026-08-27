import { beforeAll, describe, expect, it } from "vitest";
import path from "node:path";
import { closeDb, openDb } from "../src/main/db/connection";
import { migrate } from "../src/main/db/migrate";
import { seedBibleIfEmpty } from "../src/main/db/bible-seed";
import * as bible from "../src/main/db/repo/bible";
import { buildFtsQuery } from "../src/main/db/repo/bible";

const SEED = path.resolve(import.meta.dirname, "../resources/bible-seed.json");

/**
 * The desktop Bible, end to end: the schema, the 31,102-verse load, and every
 * read the shared picker makes.
 *
 * This is the half of the feature the web test suite cannot reach. The picker
 * itself is the web app's component and is covered there; what is new here is
 * SQLite — an FTS5 index instead of a tsvector, integers instead of booleans,
 * JSON text instead of arrays — and all three are places where "it compiles"
 * and "it is correct" come apart.
 */
beforeAll(() => {
  const db = openDb();
  migrate(db);
  seedBibleIfEmpty(db, SEED);
  return () => closeDb();
});

describe("seedBibleIfEmpty", () => {
  it("loads the whole canon", () => {
    const db = openDb();
    const counts = db
      .prepare(
        `select (select count(*) from bible_verses) as verses,
                (select count(*) from bible_books) as books,
                (select count(distinct book_id || ':' || chapter) from bible_verses) as chapters,
                (select count(*) from bible_translations) as translations`,
      )
      .get() as Record<string, number>;

    expect(counts).toEqual({ verses: 31102, books: 66, chapters: 1189, translations: 1 });
  });

  it("is a no-op the second time", () => {
    // Every launch calls this; the second one must not load a second Bible.
    expect(seedBibleIfEmpty(openDb(), SEED)).toBe(false);
    const { n } = openDb().prepare("select count(*) as n from bible_verses").get() as {
      n: number;
    };
    expect(n).toBe(31102);
  });
});

describe("reads", () => {
  it("returns books with their aliases parsed back into an array", () => {
    // Stored as JSON text because SQLite has no arrays. Handing the renderer
    // the raw string would break the reference parser silently.
    const books = bible.books();
    expect(books).toHaveLength(66);
    expect(books[0].name).toBe("Genesis");
    expect(books[65].name).toBe("Revelation");

    const john = books.find((b) => b.name === "John")!;
    expect(Array.isArray(john.aliases)).toBe(true);
    expect(john.aliases).toContain("jn");
  });

  it("returns booleans, not the integers SQLite stores", () => {
    const translation = bible.translations()[0];
    expect(translation.id).toBe("kjv");
    expect(translation.is_default).toBe(true);
    expect(translation.year).toBe(1769);

    // John 3:16 begins a paragraph in the printed text.
    const [verse] = bible.passage({
      translationId: "kjv",
      bookId: 43,
      chapter: 3,
      verseStart: 16,
      verseEnd: 16,
    });
    expect(verse.paragraph).toBe(true);
    expect(verse.text).toBe(
      "For God so loved the world, that he gave his only begotten Son, that whosoever believeth in him should not perish, but have everlasting life.",
    );
  });

  it("reads a verse range, and a whole chapter", () => {
    const range = bible.passage({
      translationId: "kjv",
      bookId: 43,
      chapter: 3,
      verseStart: 16,
      verseEnd: 18,
    });
    expect(range.map((v) => v.verse)).toEqual([16, 17, 18]);

    const chapter = bible.passage({
      translationId: "kjv",
      bookId: 19,
      chapter: 119,
      verseStart: null,
      verseEnd: null,
    });
    expect(chapter).toHaveLength(176);
  });

  it("indexes every chapter", () => {
    const index = bible.chapterIndex("kjv");
    expect(index).toHaveLength(1189);
    expect(index.find((c) => c.book_id === 19 && c.chapter === 119)?.verse_count).toBe(176);
    // The New Testament must be in there — this is the shape of the bug that
    // hid Acts through Revelation on the web build.
    expect(index.filter((c) => c.book_id >= 40)).toHaveLength(260);
    expect(index.find((c) => c.book_id === 66 && c.chapter === 22)?.verse_count).toBe(21);
  });
});

describe("buildFtsQuery", () => {
  it("ANDs bare words", () => {
    expect(buildFtsQuery("faith without works")).toBe('"faith" AND "without" AND "works"');
  });

  it("keeps a quoted phrase whole", () => {
    expect(buildFtsQuery('"my shepherd"')).toBe('"my shepherd"');
  });

  it("excludes a term after a minus", () => {
    expect(buildFtsQuery('"my shepherd" -want')).toBe('("my shepherd") NOT ("want")');
  });

  it("defuses FTS5 operators typed by accident", () => {
    // Unquoted, each of these is either a syntax error or a different query
    // than the user meant. Quoted, they are just words.
    for (const input of ["love*", "NEAR(a b)", "a:b", "^begin", "AND"]) {
      const query = buildFtsQuery(input);
      expect(query).not.toBeNull();
      // Whatever came out, FTS5 must accept it.
      expect(() =>
        openDb()
          .prepare(`select rowid from bible_verses_fts where text match ? limit 1`)
          .all(query),
      ).not.toThrow();
    }
  });

  it("returns null when there is nothing to search for", () => {
    for (const input of ["", "   ", "-only", "!!!", '""']) {
      expect(buildFtsQuery(input)).toBeNull();
    }
  });
});

describe("search", () => {
  const find = (query: string, limit = 100) =>
    bible.search({ translationId: "kjv", query, limit });

  it("finds a verse by its words", () => {
    const hits = find("faith without works");
    expect(
      hits.some((h) => h.book.name === "James" && h.chapter === 2 && h.verse === 20),
    ).toBe(true);
  });

  it("finds a phrase", () => {
    const hits = find('"my shepherd"');
    expect(
      hits.some((h) => h.book.name === "Psalms" && h.chapter === 23 && h.verse === 1),
    ).toBe(true);
  });

  it("stems, so a word finds its other forms", () => {
    // The porter tokenizer standing in for Postgres's english configuration.
    const hits = find("comforted", 500);
    expect(hits.some((h) => /comfort(ed|eth|s)?\b/i.test(h.text))).toBe(true);
    expect(hits.length).toBeGreaterThan(10);
  });

  it("returns hits in canonical order, not by relevance", () => {
    const hits = find("shepherd", 500);
    const keys = hits.map((h) => h.book_id * 1e6 + h.chapter * 1e3 + h.verse);
    expect(keys).toEqual([...keys].sort((a, b) => a - b));
    // Genesis before Revelation.
    expect(hits[0].book_id).toBeLessThan(hits[hits.length - 1].book_id);
  });

  it("carries the book on every hit, aliases and all", () => {
    const [hit] = find('"Jesus wept"');
    expect(hit.book.name).toBe("John");
    expect(hit.chapter).toBe(11);
    expect(hit.verse).toBe(35);
    expect(hit.book.aliases).toContain("jn");
  });

  it("honours the limit", () => {
    expect(find("the", 25)).toHaveLength(25);
  });

  it("returns nothing rather than throwing on an empty query", () => {
    expect(find("")).toEqual([]);
    expect(find("   ")).toEqual([]);
  });
});
