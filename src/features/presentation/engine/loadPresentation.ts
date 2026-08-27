import { fetchSongWithSections } from "@/features/songs/api";
import { fetchBooks, fetchPassage, fetchTranslations } from "@/features/bible/api";
import {
  decodeReference,
  encodeReference,
  formatReference,
  type ParsedReference,
} from "@/features/bible/reference";
import { supabase } from "@/lib/supabase/client";
import {
  newPassageGroupId,
  slidesFromPassage,
  slidesFromSong,
} from "@/features/presentation/engine/slides";
import type { PresentationSlide, ScriptureSlide } from "@/types/presentation";
import type { BibleTranslation } from "@/types/bible";

/**
 * Fetching, and only fetching. The rules that turn rows into slides live in
 * ./slides.ts because this module is replaced wholesale on the desktop build
 * — see the alias table in desktop/electron.vite.config.ts.
 */

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

/** Fetches a passage and turns it into slides, ready to be started or appended. */
export async function buildPassageSlides(
  reference: ParsedReference,
  translation: Pick<BibleTranslation, "id" | "abbreviation">,
): Promise<{ title: string; slides: ScriptureSlide[] }> {
  const verses = await fetchPassage(translation.id, reference);

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
