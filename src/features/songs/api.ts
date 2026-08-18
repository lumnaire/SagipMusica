import { supabase } from "@/lib/supabase/client";
import type {
  Song,
  SongSection,
  SectionMedia,
  SongWithSections,
  SongSectionWithMedia,
} from "@/types/database";

export interface SongFormValues {
  title: string;
  author: string;
  composer: string;
  category: string;
  key: string;
  tempo: string;
  description: string;
}

export interface SectionFormValues {
  id?: string;
  type: SongSection["type"];
  title: string;
  lyrics: string;
  order_index: number;
}

export async function fetchSongWithSections(songId: string): Promise<SongWithSections> {
  const { data: song, error: songError } = await supabase
    .from("songs")
    .select("*")
    .eq("id", songId)
    .single();
  if (songError) throw songError;

  const { data: sections, error: sectionsError } = await supabase
    .from("song_sections")
    .select("*")
    .eq("song_id", songId)
    .order("order_index", { ascending: true });
  if (sectionsError) throw sectionsError;

  const sectionIds = (sections ?? []).map((s) => s.id);
  let mediaBySectionId: Record<string, SectionMedia[]> = {};

  if (sectionIds.length > 0) {
    const { data: media, error: mediaError } = await supabase
      .from("section_media")
      .select("*")
      .in("section_id", sectionIds);
    if (mediaError) throw mediaError;
    mediaBySectionId = (media ?? []).reduce<Record<string, SectionMedia[]>>((acc, m) => {
      (acc[m.section_id] ??= []).push(m);
      return acc;
    }, {});
  }

  const hydratedSections: SongSectionWithMedia[] = (sections ?? []).map((s) => ({
    ...s,
    media: mediaBySectionId[s.id] ?? [],
  }));

  return { ...(song as Song), sections: hydratedSections };
}

export async function createSong(values: SongFormValues): Promise<Song> {
  const { data, error } = await supabase
    .from("songs")
    .insert({
      title: values.title,
      author: values.author || null,
      composer: values.composer || null,
      category: values.category || null,
      key: values.key || null,
      tempo: values.tempo || null,
      description: values.description || null,
    })
    .select()
    .single();
  if (error) throw error;
  return data as Song;
}

export async function updateSong(songId: string, values: SongFormValues): Promise<Song> {
  const { data, error } = await supabase
    .from("songs")
    .update({
      title: values.title,
      author: values.author || null,
      composer: values.composer || null,
      category: values.category || null,
      key: values.key || null,
      tempo: values.tempo || null,
      description: values.description || null,
    })
    .eq("id", songId)
    .select()
    .single();
  if (error) throw error;
  return data as Song;
}

export async function deleteSong(songId: string): Promise<void> {
  const { error } = await supabase.from("songs").delete().eq("id", songId);
  if (error) throw error;
}

/**
 * Replaces all sections for a song with the given list. Sections that
 * exist in the DB but are no longer present are deleted (their media
 * cascades via FK); new ones are inserted; existing ones are updated.
 */
export async function saveSongSections(
  songId: string,
  sections: SectionFormValues[],
  existingIds: string[],
): Promise<SongSection[]> {
  const keepIds = sections.filter((s) => s.id).map((s) => s.id!) as string[];
  const toDelete = existingIds.filter((id) => !keepIds.includes(id));

  if (toDelete.length > 0) {
    const { error } = await supabase.from("song_sections").delete().in("id", toDelete);
    if (error) throw error;
  }

  const results: SongSection[] = [];
  for (const section of sections) {
    if (section.id) {
      const { data, error } = await supabase
        .from("song_sections")
        .update({
          type: section.type,
          title: section.title,
          lyrics: section.lyrics,
          order_index: section.order_index,
        })
        .eq("id", section.id)
        .select()
        .single();
      if (error) throw error;
      results.push(data as SongSection);
    } else {
      const { data, error } = await supabase
        .from("song_sections")
        .insert({
          song_id: songId,
          type: section.type,
          title: section.title,
          lyrics: section.lyrics,
          order_index: section.order_index,
        })
        .select()
        .single();
      if (error) throw error;
      results.push(data as SongSection);
    }
  }

  return results;
}
