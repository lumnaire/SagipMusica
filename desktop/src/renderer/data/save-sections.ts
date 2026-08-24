import type { SongSection } from "@/types/database";
import type { SectionFormValues } from "@shared/contract";
import { invoke } from "./invoke";

export type { SectionFormValues };

/** The minimum a saved section row has to expose for re-keying client state. */
interface SavedSection {
  id: string;
  order_index: number;
}

interface SaveSectionsOptions {
  table: string;
  parentColumn: string;
  parentId: string;
  sections: SectionFormValues[];
  existingIds: string[];
}

/**
 * Desktop stand-in for src/lib/save-sections.ts.
 *
 * Same signature, but the delete/insert/update diff happens inside a single
 * SQLite transaction in main rather than across several PostgREST round trips,
 * so a song can no longer end up half-saved. Only `song_sections` is writable
 * here — the library catalog ships read-only and there is no encoder on the
 * desktop; main rejects any other table.
 *
 * The generic is kept so the web modules that call this with an explicit type
 * argument still compile against it.
 */
export async function saveSections<T extends SavedSection>({
  table,
  parentColumn,
  parentId,
  sections,
  existingIds,
}: SaveSectionsOptions): Promise<T[]> {
  const rows: SongSection[] = await invoke("sections.save", {
    table,
    parentColumn,
    parentId,
    sections,
    existingIds,
  });
  return rows as unknown as T[];
}
