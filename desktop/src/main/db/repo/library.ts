import type { HymnTemplate, Song } from "@/types/database";
import type { LibraryEntry } from "@shared/contract";
import { getDb } from "../connection";
import { LOCAL_CHURCH_ID } from "../ids";
import { OpError, isUniqueViolation } from "../errors";
import * as songs from "./songs";
import * as sections from "./sections";

/** better-sqlite3 hands back 0/1 for `is_starter`; the UI type wants a boolean. */
type TemplateRow = Omit<HymnTemplate, "is_starter"> & { is_starter: number };

const hydrate = <T extends TemplateRow>(row: T) => ({
  ...row,
  is_starter: row.is_starter === 1,
});

/**
 * The bundled catalog. Only published rows are listed — matching the RLS
 * policy in 0012 that hides drafts from anyone who is not an encoder, and
 * there is no encoder on the desktop.
 */
export function list(): LibraryEntry[] {
  const rows = getDb()
    .prepare(
      `select t.*, (select count(*) from hymn_template_sections x where x.template_id = t.id)
                as section_count
       from hymn_templates t
       where t.status = 'published'
       order by t.title collate nocase`,
    )
    .all() as (TemplateRow & { section_count: number })[];
  return rows.map(hydrate) as LibraryEntry[];
}

export function addedTemplateIds(): string[] {
  const rows = getDb()
    .prepare(
      `select distinct source_template_id from songs
       where church_id = ? and source_template_id is not null`,
    )
    .all(LOCAL_CHURCH_ID) as { source_template_id: string }[];
  return rows.map((r) => r.source_template_id);
}

/**
 * Copies a library song into the local hymnal. The copy is owned outright from
 * that moment on, exactly as in the hosted app.
 *
 * A second add violates the partial unique index idx_songs_church_template,
 * which is translated into ALREADY_IN_HYMNAL so the renderer can re-throw
 * AlreadyInHymnalError and SongLibraryPage's existing branch still fires.
 */
export function addToChurch(templateId: string): Song {
  const db = getDb();
  const template = db
    .prepare("select * from hymn_templates where id = ?")
    .get(templateId) as TemplateRow | undefined;
  if (!template) throw new Error("That song is no longer in the library.");

  const rows = db
    .prepare(
      "select type, title, lyrics, order_index from hymn_template_sections where template_id = ? order by order_index",
    )
    .all(templateId) as {
    type: string;
    title: string;
    lyrics: string;
    order_index: number;
  }[];

  return db.transaction(() => {
    let song: Song;
    try {
      song = songs.create(
        {
          title: template.title,
          author: template.author ?? "",
          composer: template.composer ?? "",
          category: template.category ?? "",
          key: template.key ?? "",
          tempo: template.tempo ?? "",
          description: template.description ?? "",
        },
        templateId,
      );
    } catch (err) {
      if (isUniqueViolation(err)) {
        throw new OpError("ALREADY_IN_HYMNAL", "That song is already in your hymnal.");
      }
      throw err;
    }

    if (rows.length > 0) {
      sections.save({
        table: "song_sections",
        parentColumn: "song_id",
        parentId: song.id,
        sections: rows.map((s, i) => ({
          type: s.type as never,
          title: s.title,
          lyrics: s.lyrics,
          order_index: i,
        })),
        existingIds: [],
      });
    }

    return song;
  })();
}
