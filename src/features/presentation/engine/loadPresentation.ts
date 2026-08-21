import { fetchSongWithSections } from "@/features/songs/api";
import { supabase } from "@/lib/supabase/client";
import type { PresentationSlide } from "@/types/presentation";
import type { SongWithSections } from "@/types/database";

function slidesFromSong(song: SongWithSections): PresentationSlide[] {
  // Each song opens with a title card, then runs straight through its
  // sections. The title is not repeated on the lyric slides.
  const titleSlide: PresentationSlide = {
    id: `${song.id}:title`,
    kind: "title",
    songId: song.id,
    songTitle: song.title,
    songAuthor: song.author,
    sectionId: "title",
    sectionType: "custom",
    sectionTitle: "Title",
    lyrics: "",
  };

  const lyricSlides: PresentationSlide[] = song.sections.map((section) => ({
    id: `${song.id}:${section.id}`,
    kind: "lyrics",
    songId: song.id,
    songTitle: song.title,
    songAuthor: song.author,
    sectionId: section.id,
    sectionType: section.type,
    sectionTitle: section.title,
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
