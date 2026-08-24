import { readFileSync } from "node:fs";
import type { Db } from "./connection";
import { nowIso } from "./connection";
import { LOCAL_CHURCH_ID, newId } from "./ids";

interface SeedTemplate {
  id: string;
  title: string;
  author: string | null;
  composer: string | null;
  category: string | null;
  key: string | null;
  tempo: string | null;
  description: string | null;
  status: string;
  is_starter: number;
  copyright_status: string;
  order_index: number;
}

interface SeedSection {
  template_id: string;
  type: string;
  title: string;
  lyrics: string;
  order_index: number;
}

interface SeedFile {
  templates: SeedTemplate[];
  sections: SeedSection[];
}

export const DEFAULT_CHURCH_NAME = "My Church";
const DEFAULT_ACCENT = "#3730a3";

/**
 * First-run population, mirroring what the hosted app does across three
 * migrations and a trigger:
 *
 *   * one `churches` row (0004), the only tenant this install will ever have;
 *   * the whole shared library (0008 + 0013) as `hymn_templates`, which is
 *     read-only here — it is the catalog shipped inside the installer;
 *   * the 20 `is_starter` hymns copied into `songs`, which is what
 *     seed_church_hymns() does on signup, so a fresh install already has a
 *     usable hymnal rather than an empty one.
 *
 * `source_template_id` is set on those copies, matching the backfill in 0012,
 * so /songs/library correctly shows them as already added.
 *
 * Idempotent by check: if a church row exists, this has already run.
 */
export function seedIfEmpty(db: Db, seedPath: string): boolean {
  const existing = db.prepare("select count(*) as n from churches").get() as { n: number };
  if (existing.n > 0) return false;

  const seed = JSON.parse(readFileSync(seedPath, "utf8")) as SeedFile;
  const ts = nowIso();

  db.transaction(() => {
    db.prepare(
      `insert into churches (id, name, referral_source, accent_color, created_by, created_at, updated_at)
       values (?, ?, null, ?, null, ?, ?)`,
    ).run(LOCAL_CHURCH_ID, DEFAULT_CHURCH_NAME, DEFAULT_ACCENT, ts, ts);

    const insTemplate = db.prepare(
      `insert into hymn_templates
         (id, title, author, composer, category, key, tempo, description,
          status, is_starter, copyright_status, order_index, created_at, updated_at, updated_by)
       values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, null)`,
    );
    for (const t of seed.templates) {
      insTemplate.run(
        t.id,
        t.title,
        t.author,
        t.composer,
        t.category,
        t.key,
        t.tempo,
        t.description,
        t.status,
        t.is_starter,
        t.copyright_status,
        t.order_index,
        ts,
        ts,
      );
    }

    const insTemplateSection = db.prepare(
      `insert into hymn_template_sections (id, template_id, type, title, lyrics, order_index)
       values (?, ?, ?, ?, ?, ?)`,
    );
    for (const s of seed.sections) {
      insTemplateSection.run(newId(), s.template_id, s.type, s.title, s.lyrics, s.order_index);
    }

    // Copy the starters into the church's own hymnal.
    const insSong = db.prepare(
      `insert into songs
         (id, church_id, title, author, composer, category, key, tempo, description,
          source_template_id, created_at, updated_at)
       values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    );
    const insSongSection = db.prepare(
      `insert into song_sections
         (id, church_id, song_id, type, title, lyrics, order_index, created_at, updated_at)
       values (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    );
    const sectionsFor = db.prepare(
      `select type, title, lyrics, order_index from hymn_template_sections
       where template_id = ? order by order_index`,
    );

    const starters = seed.templates
      .filter((t) => t.is_starter === 1)
      .sort((a, b) => a.order_index - b.order_index);

    for (const t of starters) {
      const songId = newId();
      insSong.run(
        songId,
        LOCAL_CHURCH_ID,
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
      const rows = sectionsFor.all(t.id) as Omit<SeedSection, "template_id">[];
      for (const s of rows) {
        insSongSection.run(
          newId(),
          LOCAL_CHURCH_ID,
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
  })();

  return true;
}
