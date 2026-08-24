import type { Song, SongWithSections } from "@/types/database";
import type { LibraryEntry, SongFormValues } from "@shared/contract";
import { hasCode, invoke } from "./invoke";
import { saveSections, type SectionFormValues } from "./save-sections";

export type { SectionFormValues, SongFormValues, LibraryEntry };

/**
 * Desktop stand-in for src/features/songs/api.ts.
 *
 * Every export below matches the Supabase version's name and signature — the
 * Vite alias in electron.vite.config.ts swaps this file in at that exact
 * specifier, so SongsListPage, SongEditorPage and SongLibraryPage import it
 * without knowing anything changed.
 */

/** Raised when a library song is already in the church's hymnal. */
export class AlreadyInHymnalError extends Error {
  constructor() {
    super("That song is already in your hymnal.");
    this.name = "AlreadyInHymnalError";
  }
}

export function fetchSongWithSections(songId: string): Promise<SongWithSections> {
  return invoke("songs.get", { songId });
}

export function createSong(
  values: SongFormValues,
  sourceTemplateId?: string,
): Promise<Song> {
  return invoke("songs.create", { values, sourceTemplateId: sourceTemplateId ?? null });
}

export function updateSong(songId: string, values: SongFormValues): Promise<Song> {
  return invoke("songs.update", { songId, values });
}

export async function deleteSong(songId: string): Promise<void> {
  await invoke("songs.delete", { songId });
}

export function saveSongSections(
  songId: string,
  sections: SectionFormValues[],
  existingIds: string[],
) {
  return saveSections({
    table: "song_sections",
    parentColumn: "song_id",
    parentId: songId,
    sections,
    existingIds,
  });
}

export async function fetchAddedTemplateIds(): Promise<Set<string>> {
  // Sent as an array because a Set does not survive structured cloning
  // usefully; the UI wants the Set back, so it is rebuilt here.
  return new Set(await invoke("library.addedTemplateIds"));
}

/**
 * Copies a library song into the local hymnal.
 *
 * The unique-index violation that means "already added" travels back as a
 * tagged code, and is turned into the same AlreadyInHymnalError the web build
 * throws — which is what keeps SongLibraryPage's existing branch working.
 */
export async function addLibrarySongToChurch(templateId: string): Promise<Song> {
  try {
    return await invoke("library.addToChurch", { templateId });
  } catch (err) {
    if (hasCode(err, "ALREADY_IN_HYMNAL")) throw new AlreadyInHymnalError();
    throw err;
  }
}

/** The bundled catalog. Read-only on the desktop — it ships in the installer. */
export function fetchHymnLibrary(): Promise<LibraryEntry[]> {
  return invoke("library.list");
}
