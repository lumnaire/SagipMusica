import schemaSql from "./schema.sql?raw";
import type { Db } from "./connection";
import { nowIso } from "./connection";
import { newId } from "./ids";

/**
 * Copies every published template that is not already in the hymnal into it.
 *
 * The upgrade half of the change described in seed.ts: 1.0.0 installs were
 * seeded with the 20 starters and left the other 399 hymns behind the library
 * page, which 1.0.1 removes. Without this, upgrading would strand those songs
 * in a catalog with no way in.
 *
 * On a fresh install this runs before seedIfEmpty against an empty database
 * and finds nothing to do — the seed then copies the same set itself. Both
 * paths land on the same hymnal.
 */
function adoptLibraryIntoHymnal(db: Db): void {
  const church = db.prepare("select id from churches limit 1").get() as
    | { id: string }
    | undefined;
  // No church row yet: this is a fresh database and seedIfEmpty owns the copy.
  if (!church) return;

  const missing = db
    .prepare(
      `select t.id, t.title, t.author, t.composer, t.category, t.key, t.tempo, t.description
       from hymn_templates t
       where t.status = 'published'
         and not exists (
           select 1 from songs s
           where s.church_id = ? and s.source_template_id = t.id
         )
       order by t.order_index`,
    )
    .all(church.id) as {
    id: string;
    title: string;
    author: string | null;
    composer: string | null;
    category: string | null;
    key: string | null;
    tempo: string | null;
    description: string | null;
  }[];

  if (missing.length === 0) return;

  const ts = nowIso();
  const insSong = db.prepare(
    `insert into songs
       (id, church_id, title, author, composer, category, key, tempo, description,
        source_template_id, created_at, updated_at)
     values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  const insSection = db.prepare(
    `insert into song_sections
       (id, church_id, song_id, type, title, lyrics, order_index, created_at, updated_at)
     values (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  const sectionsFor = db.prepare(
    `select type, title, lyrics, order_index from hymn_template_sections
     where template_id = ? order by order_index`,
  );

  for (const t of missing) {
    const songId = newId();
    insSong.run(
      songId,
      church.id,
      t.title,
      t.author,
      t.composer,
      t.category,
      t.key,
      t.tempo,
      t.description,
      t.id,
      ts,
      ts,
    );
    const rows = sectionsFor.all(t.id) as {
      type: string;
      title: string;
      lyrics: string;
      order_index: number;
    }[];
    for (const s of rows) {
      insSection.run(
        newId(),
        church.id,
        songId,
        s.type,
        s.title,
        s.lyrics,
        s.order_index,
        ts,
        ts,
      );
    }
  }
}

/**
 * Ordered migrations, driven by SQLite's `user_version` pragma. Step N runs
 * when user_version < N and bumps it to N. Never edit a shipped step — add a
 * new one, or installs in the field will diverge from fresh ones.
 */
const MIGRATIONS: { version: number; up: (db: Db) => void }[] = [
  {
    version: 1,
    up: (db) => db.exec(schemaSql),
  },
  {
    // 1.0.1: the library page is gone, so the library belongs in the hymnal.
    version: 2,
    up: adoptLibraryIntoHymnal,
  },
];

export function migrate(db: Db): number {
  const current = db.pragma("user_version", { simple: true }) as number;
  const pending = MIGRATIONS.filter((m) => m.version > current).sort(
    (a, b) => a.version - b.version,
  );

  for (const migration of pending) {
    // Each step is its own transaction so a failure leaves user_version
    // pointing at the last step that fully applied.
    db.transaction(() => {
      migration.up(db);
      // Pragmas cannot be parameterised; the value is a literal from this file.
      db.pragma(`user_version = ${migration.version}`);
    })();
  }

  return db.pragma("user_version", { simple: true }) as number;
}

export const LATEST_VERSION = Math.max(...MIGRATIONS.map((m) => m.version));
