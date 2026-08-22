import { supabase } from "@/lib/supabase/client";
import { saveSections, type SectionFormValues } from "@/lib/save-sections";
import type {
  HymnTemplateSection,
  Song,
  SongSection,
  SongWithSections,
} from "@/types/database";

export type { SectionFormValues };

export interface SongFormValues {
  title: string;
  author: string;
  composer: string;
  category: string;
  key: string;
  tempo: string;
  description: string;
}

/** Raised when a library song is already in the church's hymnal. */
export class AlreadyInHymnalError extends Error {
  constructor() {
    super("That song is already in your hymnal.");
    this.name = "AlreadyInHymnalError";
  }
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

export async function createSong(
  values: SongFormValues,
  sourceTemplateId?: string,
): Promise<Song> {
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
      source_template_id: sourceTemplateId ?? null,
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
  return saveSections<SongSection>({
    table: "song_sections",
    parentColumn: "song_id",
    parentId: songId,
    sections,
    existingIds,
  });
}

/**
 * The template ids this church has already copied in, so the library page can
 * show an "Added" state. One query rather than one per card.
 */
export async function fetchAddedTemplateIds(): Promise<Set<string>> {
  const { data, error } = await supabase
    .from("songs")
    .select("source_template_id")
    .not("source_template_id", "is", null);
  if (error) throw error;
  return new Set(
    (data ?? [])
      .map((row) => (row as { source_template_id: string | null }).source_template_id)
      .filter((id): id is string => !!id),
  );
}

/**
 * Copies a library song into the caller's church. The copy is theirs from that
 * moment on — later encoder edits to the template never reach it.
 *
 * No RPC needed: an admin already has INSERT on songs/song_sections under RLS,
 * and church_id is filled by the existing trigger.
 */
export async function addLibrarySongToChurch(templateId: string): Promise<Song> {
  const { data: template, error: templateError } = await supabase
    .from("hymn_templates")
    .select("*")
    .eq("id", templateId)
    .single();
  if (templateError) throw templateError;

  const { data: sections, error: sectionsError } = await supabase
    .from("hymn_template_sections")
    .select("*")
    .eq("template_id", templateId)
    .order("order_index", { ascending: true });
  if (sectionsError) throw sectionsError;

  const t = template as {
    title: string;
    author: string | null;
    composer: string | null;
    category: string | null;
    key: string | null;
    tempo: string | null;
    description: string | null;
  };

  let song: Song;
  try {
    song = await createSong(
      {
        title: t.title,
        author: t.author ?? "",
        composer: t.composer ?? "",
        category: t.category ?? "",
        key: t.key ?? "",
        tempo: t.tempo ?? "",
        description: t.description ?? "",
      },
      templateId,
    );
  } catch (err) {
    // idx_songs_church_template — two tabs, or a stale "Add" button.
    if ((err as { code?: string })?.code === "23505") throw new AlreadyInHymnalError();
    throw err;
  }

  const rows = (sections ?? []) as HymnTemplateSection[];
  if (rows.length > 0) {
    await saveSongSections(
      song.id,
      rows.map((s, i) => ({
        type: s.type,
        title: s.title,
        lyrics: s.lyrics,
        order_index: i,
      })),
      [],
    );
  }

  return song;
}
