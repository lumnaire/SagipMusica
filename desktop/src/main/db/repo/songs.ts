import type { Song, SongSection, SongWithSections } from "@/types/database";
import type { SongFormValues, SongListItem, SongPickerRow } from "@shared/contract";
import { getDb, nowIso } from "../connection";
import { LOCAL_CHURCH_ID, newId } from "../ids";

/** Empty strings from the form mean "not set", exactly as the web api does. */
const orNull = (v: string): string | null => v || null;

export function list(): SongListItem[] {
  return getDb()
    .prepare(
      `select s.*, (select count(*) from song_sections x where x.song_id = s.id) as section_count
       from songs s
       where s.church_id = ?
       order by s.updated_at desc`,
    )
    .all(LOCAL_CHURCH_ID) as SongListItem[];
}

export function get(songId: string): SongWithSections {
  const song = getDb().prepare("select * from songs where id = ?").get(songId) as
    | Song
    | undefined;
  if (!song) throw new Error("Song not found.");

  const sections = getDb()
    .prepare("select * from song_sections where song_id = ? order by order_index")
    .all(songId) as SongSection[];

  return { ...song, sections };
}

export function create(values: SongFormValues, sourceTemplateId: string | null): Song {
  const id = newId();
  const ts = nowIso();
  getDb()
    .prepare(
      `insert into songs
         (id, church_id, title, author, composer, category, key, tempo, description,
          source_template_id, created_at, updated_at)
       values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      id,
      LOCAL_CHURCH_ID,
      values.title,
      orNull(values.author),
      orNull(values.composer),
      orNull(values.category),
      orNull(values.key),
      orNull(values.tempo),
      orNull(values.description),
      sourceTemplateId,
      ts,
      ts,
    );
  return getDb().prepare("select * from songs where id = ?").get(id) as Song;
}

export function update(songId: string, values: SongFormValues): Song {
  getDb()
    .prepare(
      `update songs
       set title = ?, author = ?, composer = ?, category = ?, key = ?, tempo = ?,
           description = ?, updated_at = ?
       where id = ?`,
    )
    .run(
      values.title,
      orNull(values.author),
      orNull(values.composer),
      orNull(values.category),
      orNull(values.key),
      orNull(values.tempo),
      orNull(values.description),
      nowIso(),
      songId,
    );
  const row = getDb().prepare("select * from songs where id = ?").get(songId) as
    | Song
    | undefined;
  if (!row) throw new Error("Song not found.");
  return row;
}

export function remove(songId: string): void {
  getDb().prepare("delete from songs where id = ?").run(songId);
}

export function picker(): SongPickerRow[] {
  return getDb()
    .prepare(
      "select id, title, author, category from songs where church_id = ? order by title collate nocase",
    )
    .all(LOCAL_CHURCH_ID) as SongPickerRow[];
}
