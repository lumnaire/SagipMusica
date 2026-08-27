import {
  newPassageGroupId,
  slidesFromPassage,
  slidesFromSong,
} from "@/features/presentation/engine/slides";
import {
  decodeReference,
  encodeReference,
  formatReference,
  type ParsedReference,
} from "@/features/bible/reference";
import type { PresentationSlide, ScriptureSlide } from "@/types/presentation";
import type { BibleTranslation } from "@/types/bible";
import { invoke } from "./invoke";

/**
 * Desktop stand-in for src/features/presentation/engine/loadPresentation.ts.
 *
 * Only the fetching differs. The rules that turn rows into slides — the title
 * card, the section labels, one verse of scripture per slide — are imported
 * from the shared ./slides module rather than restated here, so the two builds
 * cannot drift apart on what a presentation looks like. That module is NOT
 * aliased; this one is.
 */

export async function loadSongSlides(songId: string): Promise<{
  title: string;
  slides: PresentationSlide[];
}> {
  const song = await invoke("songs.get", { songId });
  return { title: song.title, slides: slidesFromSong(song) };
}

export async function loadWorshipSetSlides(setId: string): Promise<{
  title: string;
  slides: PresentationSlide[];
}> {
  const { set, items } = await invoke("sets.get", { setId });

  // Sequential rather than Promise.all: these are IPC calls to one synchronous
  // SQLite connection, so firing them together only queues them anyway, and
  // the order of `items` is the order of the service.
  const slides: PresentationSlide[] = [];
  for (const item of items) {
    slides.push(...slidesFromSong(await invoke("songs.get", { songId: item.song_id })));
  }

  return { title: set.name, slides };
}

/** Fetches a passage and turns it into slides, ready to be started or appended. */
export async function buildPassageSlides(
  reference: ParsedReference,
  translation: Pick<BibleTranslation, "id" | "abbreviation">,
): Promise<{ title: string; slides: ScriptureSlide[] }> {
  const verses = await invoke("bible.passage", {
    translationId: translation.id,
    bookId: reference.book.id,
    chapter: reference.chapter ?? 1,
    verseStart: reference.verseStart,
    verseEnd: reference.verseEnd,
  });

  return {
    title: formatReference(reference),
    slides: slidesFromPassage(
      reference,
      translation,
      verses,
      newPassageGroupId(encodeReference(reference)),
    ),
  };
}

/** Raised when a /presentation URL names a passage that cannot be read. */
export class UnreadableReferenceError extends Error {
  constructor(encoded: string) {
    super(`Not a passage: ${encoded}`);
    this.name = "UnreadableReferenceError";
  }
}

export async function loadScriptureSlides(
  encoded: string,
  translationId: string,
): Promise<{ title: string; slides: PresentationSlide[] }> {
  const [books, translations] = await Promise.all([
    invoke("bible.books"),
    invoke("bible.translations"),
  ]);

  const reference = decodeReference(encoded, books);
  if (!reference) throw new UnreadableReferenceError(encoded);

  const translation =
    translations.find((t) => t.id === translationId) ??
    translations.find((t) => t.is_default) ??
    translations[0];
  if (!translation) throw new UnreadableReferenceError(encoded);

  return buildPassageSlides(reference, translation);
}
