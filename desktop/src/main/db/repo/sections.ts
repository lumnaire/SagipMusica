import type { SongSection } from "@/types/database";
import type { SectionFormValues } from "@shared/contract";
import { getDb, nowIso } from "../connection";
import { LOCAL_CHURCH_ID, newId } from "../ids";

/** Only song sections are editable on the desktop — there is no encoder here. */
const ALLOWED_TABLES = new Set(["song_sections"]);

interface SaveArgs {
  table: string;
  parentColumn: string;
  parentId: string;
  sections: SectionFormValues[];
  existingIds: string[];
}

/**
 * Replaces all sections belonging to one song with the given list: rows that
 * are gone get deleted, new ones inserted, survivors updated.
 *
 * Same contract as src/lib/save-sections.ts, but the whole diff runs in a
 * single transaction — the Supabase version needed one round trip per updated
 * row and could leave a song half-saved if it failed partway.
 */
export function save({
  table,
  parentColumn,
  parentId,
  sections,
  existingIds,
}: SaveArgs): SongSection[] {
  if (!ALLOWED_TABLES.has(table)) {
    throw new Error(`Refusing to write to table "${table}".`);
  }
  if (parentColumn !== "song_id") {
    throw new Error(`Refusing to write parent column "${parentColumn}".`);
  }

  const db = getDb();
  const ts = nowIso();

  db.transaction(() => {
    const keep = new Set(sections.filter((s) => s.id).map((s) => s.id as string));
    const toDelete = existingIds.filter((id) => !keep.has(id));
    const del = db.prepare("delete from song_sections where id = ?");
    for (const id of toDelete) del.run(id);

    const ins = db.prepare(
      `insert into song_sections
         (id, church_id, song_id, type, title, lyrics, order_index, created_at, updated_at)
       values (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    );
    const upd = db.prepare(
      `update song_sections
       set type = ?, title = ?, lyrics = ?, order_index = ?, updated_at = ?
       where id = ?`,
    );

    for (const s of sections) {
      if (s.id) {
        upd.run(s.type, s.title, s.lyrics, s.order_index, ts, s.id);
      } else {
        ins.run(
          newId(),
          LOCAL_CHURCH_ID,
          parentId,
          s.type,
          s.title,
          s.lyrics,
          s.order_index,
          ts,
          ts,
        );
      }
    }
  })();

  // Read back rather than assembling the return value: the caller re-keys its
  // React state from these rows, so the ids have to be the real ones.
  return db
    .prepare("select * from song_sections where song_id = ? order by order_index")
    .all(parentId) as SongSection[];
}
