import type { PresentationSlide, ScriptureSlide } from "@/types/presentation";
import type { SongWithSections } from "@/types/database";
import { SECTION_TYPE_LABELS } from "@/types/database";
import type { BibleTranslation, BibleVerse } from "@/types/bible";
import { formatReference, type ParsedReference } from "@/features/bible/reference";

/**
 * How rows become slides.
 *
 * Pure, and deliberately kept out of loadPresentation.ts, because that module
 * is swapped wholesale on the desktop build (see the alias table in
 * electron.vite.config.ts). Only the FETCHING differs between the two builds;
 * the rules below — what a slide is called, how it is grouped, how much
 * scripture goes on one — are the product, and having two copies of them is
 * how a verse ends up laid out one way on the laptop and another on the
 * projector six months from now.
 */

export function slidesFromSong(song: SongWithSections): PresentationSlide[] {
  // Each song opens with a title card, then runs straight through its
  // sections. The title is not repeated on the lyric slides.
  const titleSlide: PresentationSlide = {
    id: `${song.id}:title`,
    kind: "title",
    groupId: song.id,
    groupTitle: song.title,
    label: "Title slide",
    preview: song.title,
    songTitle: song.title,
    songAuthor: song.author,
  };

  const lyricSlides: PresentationSlide[] = song.sections.map((section) => ({
    id: `${song.id}:${section.id}`,
    kind: "lyrics",
    groupId: song.id,
    groupTitle: song.title,
    label: section.title || SECTION_TYPE_LABELS[section.type],
    preview: section.lyrics.split("\n")[0] ?? "",
    songTitle: song.title,
    sectionType: section.type,
    lyrics: section.lyrics,
  }));

  return [titleSlide, ...lyricSlides];
}

/**
 * ONE VERSE PER SLIDE.
 *
 * The obvious alternative is packing verses together until the slide is full,
 * and it is worse for the thing this is actually for. Scripture is read aloud
 * a verse at a time, so a verse per slide lets the presenter advance in step
 * with the reader instead of guessing where in a block of four they are. It
 * also means the reference printed on the screen is exact — the congregation
 * is looking at verse 17 and the screen says verse 17 — which a packed slide
 * can only manage as a range.
 *
 * The cost is more slides for a long passage, which costs a keypress each, and
 * a very long verse having to be shrunk to fit (SlideCanvas does that). If a
 * church ever wants verses grouped, it is a display setting and it belongs
 * next to the font size, not baked in here.
 */
export function slidesFromPassage(
  reference: ParsedReference,
  translation: Pick<BibleTranslation, "abbreviation">,
  verses: BibleVerse[],
  /** Distinguishes two copies of the same passage in one presentation. */
  groupId: string,
): ScriptureSlide[] {
  const groupTitle = formatReference(reference);

  return verses.map((verse) => ({
    id: `${groupId}:${verse.chapter}:${verse.verse}`,
    kind: "scripture",
    groupId,
    groupTitle,
    label: `v.${verse.verse}`,
    preview: verse.text,
    reference: `${reference.book.name} ${verse.chapter}:${verse.verse}`,
    translation: translation.abbreviation,
    text: verse.text,
  }));
}

/**
 * The group id for a passage, carrying a nonce so that adding John 3:16 to a
 * presentation that already contains John 3:16 produces two separate headings
 * in the presenter's list rather than one that appears to have doubled in
 * length.
 */
export function newPassageGroupId(encodedReference: string): string {
  return `scripture:${encodedReference}:${crypto.randomUUID().slice(0, 8)}`;
}
