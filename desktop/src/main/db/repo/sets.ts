import type { WorshipSet } from "@/types/database";
import type { WorshipSetItemWithTitle, WorshipSetListItem } from "@shared/contract";
import { getDb, nowIso } from "../connection";
import { LOCAL_CHURCH_ID, newId } from "../ids";

export function list(): WorshipSetListItem[] {
  return getDb()
    .prepare(
      `select w.*, (select count(*) from worship_set_items i where i.set_id = w.id) as item_count
       from worship_sets w
       where w.church_id = ?
       order by w.updated_at desc`,
    )
    .all(LOCAL_CHURCH_ID) as WorshipSetListItem[];
}

export function get(setId: string): { set: WorshipSet; items: WorshipSetItemWithTitle[] } {
  const set = getDb().prepare("select * from worship_sets where id = ?").get(setId) as
    | WorshipSet
    | undefined;
  if (!set) throw new Error("Worship set not found.");

  // The web version relies on PostgREST's embedded select; here the join is
  // explicit and the song columns are re-nested to the same shape.
  const rows = getDb()
    .prepare(
      `select i.*, s.title as song_title, s.author as song_author, s.category as song_category
       from worship_set_items i
       join songs s on s.id = i.song_id
       where i.set_id = ?
       order by i.order_index`,
    )
    .all(setId) as (WorshipSetItemWithTitle & {
    song_title: string;
    song_author: string | null;
    song_category: string | null;
  })[];

  const items: WorshipSetItemWithTitle[] = rows.map((row) => {
    const { song_title, song_author, song_category, ...item } = row;
    return {
      ...item,
      song: {
        id: row.song_id,
        title: song_title,
        author: song_author,
        category: song_category,
      },
    };
  });

  return { set, items };
}

export function create(name: string, description: string): WorshipSet {
  const id = newId();
  const ts = nowIso();
  getDb()
    .prepare(
      `insert into worship_sets (id, church_id, name, description, created_at, updated_at)
       values (?, ?, ?, ?, ?, ?)`,
    )
    .run(id, LOCAL_CHURCH_ID, name, description || null, ts, ts);
  return getDb().prepare("select * from worship_sets where id = ?").get(id) as WorshipSet;
}

export function update(setId: string, name: string, description: string): WorshipSet {
  getDb()
    .prepare("update worship_sets set name = ?, description = ?, updated_at = ? where id = ?")
    .run(name, description || null, nowIso(), setId);
  const row = getDb().prepare("select * from worship_sets where id = ?").get(setId) as
    | WorshipSet
    | undefined;
  if (!row) throw new Error("Worship set not found.");
  return row;
}

export function remove(setId: string): void {
  getDb().prepare("delete from worship_sets where id = ?").run(setId);
}

/** Replaces the full ordered song list for a set, in one transaction. */
export function saveItems(setId: string, songIds: string[]): void {
  const db = getDb();
  const ts = nowIso();
  db.transaction(() => {
    db.prepare("delete from worship_set_items where set_id = ?").run(setId);
    const ins = db.prepare(
      `insert into worship_set_items (id, church_id, set_id, song_id, order_index, created_at)
       values (?, ?, ?, ?, ?, ?)`,
    );
    songIds.forEach((songId, index) => {
      ins.run(newId(), LOCAL_CHURCH_ID, setId, songId, index, ts);
    });
    // Touch the parent so the list page's "most recently updated" order is
    // meaningful after a reorder that changed no set columns.
    db.prepare("update worship_sets set updated_at = ? where id = ?").run(ts, setId);
  })();
}
