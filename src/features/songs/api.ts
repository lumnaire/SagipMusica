import { supabase } from "@/lib/supabase/client";
import type { Song, SongSection, SongWithSections } from "@/types/database";

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

  return { ...(song as Song), sections: (sections ?? []) as SongSection[] };
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
 * exist in the DB but are no longer present are deleted; new ones are
 * inserted; existing ones are updated.
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

  // New sections go in one round trip. Pasting a whole song creates a dozen or
  // more at once, and a row-at-a-time loop meant a dozen sequential requests
  // that could fail halfway and leave the song half-saved.
  //
  // church_id is deliberately not sent: a database trigger fills it, and the
  // client's permission to write it was revoked in 0010.
  const newSections = sections.filter((s) => !s.id);
  const insertedById = new Map<number, SongSection>();

  if (newSections.length > 0) {
    const { data, error } = await supabase
      .from("song_sections")
      .insert(
        newSections.map((section) => ({
          song_id: songId,
          type: section.type,
          title: section.title,
          lyrics: section.lyrics,
          order_index: section.order_index,
        })),
      )
      .select();
    if (error) throw error;
    for (const row of (data ?? []) as SongSection[]) {
      insertedById.set(row.order_index, row);
    }
  }

  // Existing rows are updated individually: an ordinary edit touches only a
  // few, and PostgREST has no batch-update-by-id.
  const results: SongSection[] = [];
  for (const section of sections) {
    if (!section.id) {
      const inserted = insertedById.get(section.order_index);
      if (inserted) results.push(inserted);
      continue;
    }

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
  }

  return results;
}
