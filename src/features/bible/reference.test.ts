import { describe, expect, it } from "vitest";
import {
  buildBookIndex,
  decodeReference,
  encodeReference,
  formatReference,
  normalizeBookToken,
  parseReference,
} from "./reference";
import type { BibleBook } from "@/types/bible";

/**
 * The books the cases below need, with the aliases migration 0020 seeds for
 * them. Not the whole canon: these are the ones that are hard — a name that
 * starts with a digit, a name that is a prefix of another word, the book with
 * four accepted titles, and the one whose abbreviation is its name.
 */
const BOOKS: BibleBook[] = [
  { id: 19, name: "Psalms", abbreviation: "Ps", testament: "old", aliases: ["psalm", "psa", "psm", "pss", "pslm"] },
  { id: 22, name: "Song of Solomon", abbreviation: "Song", testament: "old", aliases: ["song of songs", "songs", "canticles", "cant", "sos", "sng", "solomons song"] },
  { id: 23, name: "Isaiah", abbreviation: "Isa", testament: "old", aliases: ["is", "isai"] },
  { id: 43, name: "John", abbreviation: "John", testament: "new", aliases: ["jn", "jhn", "joh"] },
  { id: 57, name: "Philemon", abbreviation: "Phlm", testament: "new", aliases: ["phm", "philem", "plm"] },
  { id: 62, name: "1 John", abbreviation: "1 John", testament: "new", aliases: ["1jn", "1jo", "1jhn", "1j"] },
  { id: 64, name: "3 John", abbreviation: "3 John", testament: "new", aliases: ["3jn", "3jo", "3jhn", "3j"] },
];

const index = buildBookIndex(BOOKS);

/** Compact assertion helper: "John 3:16" -> "43 3:16-16". */
function parsed(input: string): string | null {
  const result = parseReference(input, index);
  if (!result) return null;
  return `${result.book.id} ${result.chapter}:${result.verseStart}-${result.verseEnd}`;
}

describe("normalizeBookToken", () => {
  it("lowercases and strips punctuation and spaces", () => {
    expect(normalizeBookToken("Song of Solomon")).toBe("songofsolomon");
    expect(normalizeBookToken("  Jn.  ")).toBe("jn");
    expect(normalizeBookToken("Solomon's Song")).toBe("solomonssong");
  });

  it("writes leading ordinals as digits, however they were spelled", () => {
    for (const spelling of ["1 John", "I John", "1st John", "first john", "I  JOHN"]) {
      expect(normalizeBookToken(spelling)).toBe("1john");
    }
    expect(normalizeBookToken("III John")).toBe("3john");
    expect(normalizeBookToken("third john")).toBe("3john");
  });

  it("does not mistake a book that starts with i for a roman numeral", () => {
    // The bug this guards: "Isaiah" read as "I saiah" and resolved to a
    // nonexistent first book of Saiah.
    expect(normalizeBookToken("Isaiah")).toBe("isaiah");
    expect(normalizeBookToken("Is")).toBe("is");
  });
});

describe("parseReference", () => {
  it("reads a single verse however it is punctuated", () => {
    for (const input of ["John 3:16", "john 3:16", "Jn 3.16", "JOHN 3 16", "jhn3:16", "  John   3 : 16  "]) {
      expect(parsed(input)).toBe("43 3:16-16");
    }
  });

  it("reads a verse range", () => {
    expect(parsed("John 3:16-18")).toBe("43 3:16-18");
    expect(parsed("John 3:16–18")).toBe("43 3:16-18"); // en dash
    expect(parsed("John 3:16 - 18")).toBe("43 3:16-18");
  });

  it("reads a whole chapter", () => {
    const result = parseReference("Psalm 23", index);
    expect(result?.book.id).toBe(19);
    expect(result?.chapter).toBe(23);
    expect(result?.verseStart).toBeNull();
  });

  it("reads a bare book name", () => {
    const result = parseReference("Philemon", index);
    expect(result?.book.id).toBe(57);
    expect(result?.chapter).toBeNull();
  });

  it("handles books whose name begins with a digit", () => {
    // The lazy book group has to grow past "1" before "John" can be rejected
    // as a chapter number. This is the case that breaks a naive split.
    expect(parsed("1 John 4:7")).toBe("62 4:7-7");
    expect(parsed("1jn 4:7")).toBe("62 4:7-7");
    expect(parsed("I John 4:7")).toBe("62 4:7-7");
    expect(parsed("first john 4:7")).toBe("62 4:7-7");
    expect(parsed("3 John 1:4")).toBe("64 1:4-4");
    expect(parsed("III John 1:4")).toBe("64 1:4-4");
  });

  it("accepts every accepted title of the Song", () => {
    for (const input of ["Song of Solomon 2:1", "Song of Songs 2:1", "Canticles 2:1", "sos 2:1", "Solomon's Song 2:1"]) {
      expect(parsed(input)).toBe("22 2:1-1");
    }
  });

  it("reads a backwards range as the verse it starts on", () => {
    expect(parsed("John 3:18-16")).toBe("43 3:18-18");
  });

  it("returns null for words, so the caller can search instead", () => {
    for (const input of ["", "   ", "faith without works", "so loved the world", "23", "Habakkuk 3:2"]) {
      expect(parseReference(input, index)).toBeNull();
    }
  });

  it("returns null for a book it does not know", () => {
    expect(parseReference("Enoch 1:1", index)).toBeNull();
  });
});

describe("formatReference", () => {
  const book = BOOKS.find((b) => b.id === 43)!;

  it("writes the passage the way it is cited", () => {
    expect(formatReference({ book, chapter: 3, verseStart: 16, verseEnd: 16 })).toBe("John 3:16");
    expect(formatReference({ book, chapter: 3, verseStart: 16, verseEnd: 18 })).toBe("John 3:16-18");
    expect(formatReference({ book, chapter: 3, verseStart: null, verseEnd: null })).toBe("John 3");
    expect(formatReference({ book, chapter: null, verseStart: null, verseEnd: null })).toBe("John");
  });
});

describe("encodeReference / decodeReference", () => {
  it("round-trips every shape of reference", () => {
    for (const input of ["John 3:16", "John 3:16-18", "Psalm 23", "Philemon", "1 John 4:7-8"]) {
      const reference = parseReference(input, index)!;
      const round = decodeReference(encodeReference(reference), BOOKS);
      expect(formatReference(round!)).toBe(formatReference(reference));
    }
  });

  it("encodes by book id, so nothing needs escaping", () => {
    expect(encodeReference(parseReference("Song of Solomon 2:1", index)!)).toBe("22.2.1");
    expect(encodeReference(parseReference("John 3:16-18", index)!)).toBe("43.3.16-18");
  });

  it("returns null for anything it did not write", () => {
    expect(decodeReference("John 3:16", BOOKS)).toBeNull();
    expect(decodeReference("999.1.1", BOOKS)).toBeNull();
    expect(decodeReference("", BOOKS)).toBeNull();
  });
});
