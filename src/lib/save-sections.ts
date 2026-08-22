import { supabase } from "@/lib/supabase/client";
import type { SectionType } from "@/types/database";

export interface SectionFormValues {
  id?: string;
  type: SectionType;
  title: string;
  lyrics: string;
  order_index: number;
}

/** The minimum a saved section row has to expose for re-keying client state. */
interface SavedSection {
  id: string;
  order_index: number;
}

interface SaveSectionsOptions {
  /** `song_sections` for a church's songs, `hymn_template_sections` for the library. */
  table: string;
  /** The foreign key column pointing at the parent: `song_id` or `template_id`. */
  parentColumn: string;
  parentId: string;
  sections: SectionFormValues[];
  existingIds: string[];
}

/**
 * Replaces all sections belonging to one parent with the given list. Sections
 * that exist in the DB but are no longer present are deleted; new ones are
 * inserted; existing ones are updated.
 *
 * Parameterised over the table because songs and library templates store their
 * stanzas identically but in different tables — the diffing is the interesting
 * part and there is no reason to have two copies of it.
 */
export async function saveSections<T extends SavedSection>({
  table,
  parentColumn,
  parentId,
  sections,
  existingIds,
}: SaveSectionsOptions): Promise<T[]> {
  const keepIds = sections.filter((s) => s.id).map((s) => s.id!) as string[];
  const toDelete = existingIds.filter((id) => !keepIds.includes(id));

  if (toDelete.length > 0) {
    const { error } = await supabase.from(table).delete().in("id", toDelete);
    if (error) throw error;
  }

  // New sections go in one round trip. Pasting a whole song creates a dozen or
  // more at once, and a row-at-a-time loop meant a dozen sequential requests
  // that could fail halfway and leave the song half-saved.
  //
  // church_id is deliberately not sent for song_sections: a database trigger
  // fills it, and the client's permission to write it was revoked in 0010.
  const newSections = sections.filter((s) => !s.id);
  const insertedByOrder = new Map<number, T>();

  if (newSections.length > 0) {
    const { data, error } = await supabase
      .from(table)
      .insert(
        newSections.map((section) => ({
          [parentColumn]: parentId,
          type: section.type,
          title: section.title,
          lyrics: section.lyrics,
          order_index: section.order_index,
        })),
      )
      .select();
    if (error) throw error;
    for (const row of (data ?? []) as T[]) {
      insertedByOrder.set(row.order_index, row);
    }
  }

  // Existing rows are updated individually: an ordinary edit touches only a
  // few, and PostgREST has no batch-update-by-id.
  const results: T[] = [];
  for (const section of sections) {
    if (!section.id) {
      const inserted = insertedByOrder.get(section.order_index);
      if (inserted) results.push(inserted);
      continue;
    }

    const { data, error } = await supabase
      .from(table)
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
    results.push(data as T);
  }

  return results;
}
