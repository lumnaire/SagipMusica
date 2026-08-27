import { fetchSongWithSections } from "@/features/songs/api";
import { fetchBooks, fetchPassage, fetchTranslations } from "@/features/bible/api";
import {
  decodeReference,
  encodeReference,
  formatReference,
  type ParsedReference,
} from "@/features/bible/reference";
import { supabase } from "@/lib/supabase/client";
import type { PresentationSlide, ScriptureSlide } from "@/types/presentation";
import type { SongWithSections } from "@/types/database";
import { SECTION_TYPE_LABELS } from "@/types/database";
import type { BibleTranslation, BibleVerse } from "@/types/bible";

function slidesFromSong(song: SongWithSections): PresentationSlide[] {
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

export async function loadSongSlides(songId: string): Promise<{
  title: string;
  slides: PresentationSlide[];
}> {
  const song = await fetchSongWithSections(songId);
  return { title: song.title, slides: slidesFromSong(song) };
}

export async function loadWorshipSetSlides(setId: string): Promise<{
  title: string;
  slides: PresentationSlide[];
}> {
  const { data: set, error: setError } = await supabase
    .from("worship_sets")
    .select("*")
    .eq("id", setId)
    .single();
  if (setError) throw setError;

  const { data: items, error: itemsError } = await supabase
    .from("worship_set_items")
    .select("*")
    .eq("set_id", setId)
    .order("order_index", { ascending: true });
  if (itemsError) throw itemsError;

  const songs = await Promise.all(
    (items ?? []).map((item) => fetchSongWithSections(item.song_id)),
  );

  const slides = songs.flatMap(slidesFromSong);
  return { title: set.name as string, slides };
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
 * Fetches a passage and turns it into slides, ready to be started or appended.
 *
 * The group id carries a nonce so that adding John 3:16 to a presentation that
 * already contains John 3:16 produces two separate headings in the presenter's
 * list rather than one that appears to have doubled in length.
 */
export async function buildPassageSlides(
  reference: ParsedReference,
  translation: Pick<BibleTranslation, "id" | "abbreviation">,
): Promise<{ title: string; slides: ScriptureSlide[] }> {
  const verses = await fetchPassage(translation.id, reference);
  const groupId = `scripture:${encodeReference(reference)}:${crypto.randomUUID().slice(0, 8)}`;

  return {
    title: formatReference(reference),
    slides: slidesFromPassage(reference, translation, verses, groupId),
  };
}

/** Raised when a /presentation URL names a passage that cannot be read. */
export class UnreadableReferenceError extends Error {
  constructor(encoded: string) {
    super(`Not a passage: ${encoded}`);
    this.name = "UnreadableReferenceError";
  }
}

/**
 * Loads a passage named in a URL — `?type=scripture&ref=43.3.16-18`. See
 * encodeReference for the format.
 */
export async function loadScriptureSlides(
  encoded: string,
  translationId: string,
): Promise<{ title: string; slides: PresentationSlide[] }> {
  const [books, translations] = await Promise.all([fetchBooks(), fetchTranslations()]);

  const reference = decodeReference(encoded, books);
  if (!reference) throw new UnreadableReferenceError(encoded);

  const translation =
    translations.find((t) => t.id === translationId) ??
    translations.find((t) => t.is_default) ??
    translations[0];
  if (!translation) throw new UnreadableReferenceError(encoded);

  return buildPassageSlides(reference, translation);
}
