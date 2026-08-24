import type { PresentationSlide } from "@/types/presentation";
import type { SongWithSections } from "@/types/database";
import { invoke } from "./invoke";

/**
 * Desktop stand-in for src/features/presentation/engine/loadPresentation.ts.
 *
 * The slide-building rule is deliberately identical to the web version: one
 * title card per song, then its sections in order, with the title not repeated
 * on the lyric slides. Only the fetching changed.
 */
function slidesFromSong(song: SongWithSections): PresentationSlide[] {
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
