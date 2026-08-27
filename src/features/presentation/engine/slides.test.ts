import { describe, expect, it } from "vitest";
import { slidesFromPassage } from "./slides";
import type { BibleBook, BibleVerse } from "@/types/bible";

const JOHN: BibleBook = {
  id: 43,
  name: "John",
  abbreviation: "John",
  testament: "new",
  aliases: ["jn"],
};

const KJV = { abbreviation: "KJV" };

function verse(chapter: number, number: number, text: string): BibleVerse {
  return {
    translation_id: "kjv",
    book_id: JOHN.id,
    chapter,
    verse: number,
    text,
    paragraph: false,
  };
}

const PASSAGE = [
  verse(3, 16, "For God so loved the world…"),
  verse(3, 17, "For God sent not his Son…"),
];

describe("slidesFromPassage", () => {
  const reference = { book: JOHN, chapter: 3, verseStart: 16, verseEnd: 17 };

  it("puts one verse on each slide", () => {
    const slides = slidesFromPassage(reference, KJV, PASSAGE, "g1");

    expect(slides).toHaveLength(2);
    expect(slides.map((s) => s.text)).toEqual([
      "For God so loved the world…",
      "For God sent not his Son…",
    ]);
  });

  it("gives every slide the reference of its own verse, not of the passage", () => {
    // The congregation reads along from the screen, so a slide showing verse
    // 17 must say 17 — not "John 3:16-17" on both.
    const slides = slidesFromPassage(reference, KJV, PASSAGE, "g1");

    expect(slides.map((s) => s.reference)).toEqual(["John 3:16", "John 3:17"]);
    expect(slides.every((s) => s.translation === "KJV")).toBe(true);
  });

  it("groups the slides under the passage as cited", () => {
    const slides = slidesFromPassage(reference, KJV, PASSAGE, "g1");

    expect(slides.every((s) => s.groupId === "g1")).toBe(true);
    expect(slides.every((s) => s.groupTitle === "John 3:16-17")).toBe(true);
    expect(slides.map((s) => s.label)).toEqual(["v.16", "v.17"]);
  });

  it("keeps two copies of one passage apart", () => {
    // Adding John 3:16 to a presentation that already has it must produce a
    // second heading, not silently extend the first.
    const first = slidesFromPassage(reference, KJV, PASSAGE, "g1");
    const second = slidesFromPassage(reference, KJV, PASSAGE, "g2");

    const ids = new Set([...first, ...second].map((s) => s.id));
    expect(ids.size).toBe(4);
  });

  it("survives a passage the database returned nothing for", () => {
    expect(slidesFromPassage(reference, KJV, [], "g1")).toEqual([]);
  });
});
