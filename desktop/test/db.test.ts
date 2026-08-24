import { beforeAll, describe, expect, it } from "vitest";
import path from "node:path";
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import Database from "better-sqlite3";
import { closeDb, openDb } from "../src/main/db/connection";
import { LATEST_VERSION, migrate } from "../src/main/db/migrate";
import { seedIfEmpty } from "../src/main/db/seed";
import { LOCAL_CHURCH_ID } from "../src/main/db/ids";
import { OpError } from "../src/main/db/errors";
import * as songs from "../src/main/db/repo/songs";
import * as sections from "../src/main/db/repo/sections";
import * as sets from "../src/main/db/repo/sets";
import * as library from "../src/main/db/repo/library";
import * as church from "../src/main/db/repo/church";
import * as dashboard from "../src/main/db/repo/dashboard";
import * as profile from "../src/main/db/repo/profile";

const SEED = path.resolve(import.meta.dirname, "../resources/hymnal-seed.json");

/**
 * Read from the seed rather than hardcoded, so regenerating it with
 * `npm run seed` does not turn every count below into a failing test.
 */
const PUBLISHED_TEMPLATES = (
  JSON.parse(readFileSync(SEED, "utf8")) as { templates: { status: string }[] }
).templates.filter((t) => t.status === "published").length;

const form = (title: string, over: Partial<Record<string, string>> = {}) => ({
  title,
  author: "",
  composer: "",
  category: "",
  key: "",
  tempo: "",
  description: "",
  ...over,
});

beforeAll(() => {
  const db = openDb();
  migrate(db);
  seedIfEmpty(db, SEED);
  return () => closeDb();
});

describe("migrate", () => {
  it("stamps user_version and is a no-op the second time", () => {
    const db = openDb();
    expect(migrate(db)).toBe(LATEST_VERSION);
    expect(migrate(db)).toBe(LATEST_VERSION);
  });

  it("turns on the foreign keys the schema's cascades depend on", () => {
    expect(openDb().pragma("foreign_keys", { simple: true })).toBe(1);
  });
});

/**
 * Step 2, on its own database.
 *
 * This is the upgrade path for the installs already in the field: 1.0.0 seeded
 * the 20 starters and left the rest behind the library page that 1.0.1
 * removes. Getting this wrong strands 399 hymns somewhere the user can no
 * longer reach, so it is tested against a hand-built 1.0.0-shaped database
 * rather than against the shipped seed.
 */
describe("migrate: adopting the library into the hymnal", () => {
  function legacyInstall() {
    const db = new Database(":memory:");
    db.pragma("foreign_keys = ON");
    // Builds the schema, then finds no church and does nothing.
    migrate(db);
    // Rewind: this install stopped at 1.0.0.
    db.pragma("user_version = 1");

    const ts = new Date().toISOString();
    db.prepare(
      `insert into churches (id, name, accent_color, created_at, updated_at)
       values (?, 'My Church', '#3730a3', ?, ?)`,
    ).run(LOCAL_CHURCH_ID, ts, ts);

    const template = db.prepare(
      `insert into hymn_templates
         (id, title, author, composer, category, key, tempo, description,
          status, is_starter, copyright_status, order_index, created_at, updated_at, updated_by)
       values (?, ?, null, null, null, null, null, null, ?, ?, 'public_domain', ?, ?, ?, null)`,
    );
    const section = db.prepare(
      `insert into hymn_template_sections (id, template_id, type, title, lyrics, order_index)
       values (?, ?, 'verse', 'Verse 1', ?, 0)`,
    );

    // One starter (already copied in by 1.0.0), one published hymn that was
    // only ever in the library, and one draft that must stay out of both.
    template.run("t-starter", "Amazing Grace", "published", 1, 0, ts, ts);
    template.run("t-library", "Rock of Ages", "published", 0, 1, ts, ts);
    template.run("t-draft", "Half Written", "draft", 0, 2, ts, ts);
    section.run("s-starter", "t-starter", "how sweet the sound");
    section.run("s-library", "t-library", "cleft for me");
    section.run("s-draft", "t-draft", "unfinished");

    db.prepare(
      `insert into songs
         (id, church_id, title, source_template_id, created_at, updated_at)
       values ('song-starter', ?, 'Amazing Grace', 't-starter', ?, ?)`,
    ).run(LOCAL_CHURCH_ID, ts, ts);

    return db;
  }

  it("copies the hymns that were only in the library, with their stanzas", () => {
    const db = legacyInstall();

    expect(migrate(db)).toBe(LATEST_VERSION);

    const titles = (
      db.prepare("select title from songs order by title").all() as { title: string }[]
    ).map((r) => r.title);
    expect(titles).toEqual(["Amazing Grace", "Rock of Ages"]);

    const lyrics = db
      .prepare(
        `select x.lyrics from song_sections x
         join songs s on s.id = x.song_id
         where s.source_template_id = 't-library'`,
      )
      .get() as { lyrics: string };
    expect(lyrics.lyrics).toBe("cleft for me");

    db.close();
  });

  it("does not duplicate the hymns the church already had", () => {
    const db = legacyInstall();

    migrate(db);
    const after = db.prepare("select count(*) as n from songs").get() as { n: number };
    // Running it again must not re-copy: user_version is stamped, and the
    // NOT EXISTS guard would hold even if it were not.
    migrate(db);
    expect((db.prepare("select count(*) as n from songs").get() as { n: number }).n).toBe(
      after.n,
    );

    db.close();
  });

  it("leaves a church's own songs alone", () => {
    const db = legacyInstall();
    const ts = new Date().toISOString();
    db.prepare(
      `insert into songs (id, church_id, title, source_template_id, created_at, updated_at)
       values ('song-own', ?, 'Our Own Hymn', null, ?, ?)`,
    ).run(LOCAL_CHURCH_ID, ts, ts);

    migrate(db);

    const own = db
      .prepare("select count(*) as n from songs where title = 'Our Own Hymn'")
      .get() as { n: number };
    expect(own.n).toBe(1);

    db.close();
  });
});

describe("seed", () => {
  it("creates the one church and puts the whole library in the hymnal", () => {
    expect(church.get().id).toBe(LOCAL_CHURCH_ID);
    // Not the 20 starters the hosted app copies on signup: the desktop has no
    // library page to add the rest from, so every published hymn is copied in.
    expect(songs.list()).toHaveLength(PUBLISHED_TEMPLATES);
    expect(library.list()).toHaveLength(PUBLISHED_TEMPLATES);
  });

  it("marks every copy with the template it came from", () => {
    expect(library.addedTemplateIds()).toHaveLength(PUBLISHED_TEMPLATES);
  });

  it("does not run twice", () => {
    expect(seedIfEmpty(openDb(), SEED)).toBe(false);
    expect(songs.list()).toHaveLength(PUBLISHED_TEMPLATES);
  });

  it("gives every copied hymn the stanzas its template had", () => {
    const db = openDb();
    // The 23 metadata-only hymns ship with no stanzas on purpose (see
    // docs/hymnal-copyright-review.md), so this compares against the template
    // rather than asserting every song has lyrics.
    const mismatched = db
      .prepare(
        `select count(*) as n from songs s
         where s.source_template_id is not null
           and (select count(*) from song_sections x where x.song_id = s.id)
             <> (select count(*) from hymn_template_sections y
                 where y.template_id = s.source_template_id)`,
      )
      .get() as { n: number };
    expect(mismatched.n).toBe(0);
  });
});

describe("songs", () => {
  it("round-trips a song and leaves blank fields null", () => {
    const created = songs.create(form("Be Thou My Vision", { author: "Dallan Forgaill" }), null);
    const read = songs.get(created.id);

    expect(read.title).toBe("Be Thou My Vision");
    expect(read.author).toBe("Dallan Forgaill");
    // Empty strings from the form mean "not set", exactly as the web api does.
    expect(read.composer).toBeNull();
    expect(read.church_id).toBe(LOCAL_CHURCH_ID);
    expect(read.sections).toEqual([]);
  });

  it("cascades sections away when the song is deleted", () => {
    const song = songs.create(form("Temporary"), null);
    sections.save({
      table: "song_sections",
      parentColumn: "song_id",
      parentId: song.id,
      sections: [{ type: "verse", title: "Verse 1", lyrics: "words", order_index: 0 }],
      existingIds: [],
    });

    songs.remove(song.id);

    const orphans = openDb()
      .prepare("select count(*) as n from song_sections where song_id = ?")
      .get(song.id) as { n: number };
    expect(orphans.n).toBe(0);
  });
});

describe("sections.save", () => {
  it("inserts, updates and deletes in one pass, and returns the real ids", () => {
    const song = songs.create(form("Diffed"), null);

    const first = sections.save({
      table: "song_sections",
      parentColumn: "song_id",
      parentId: song.id,
      sections: [
        { type: "verse", title: "Verse 1", lyrics: "one", order_index: 0 },
        { type: "chorus", title: "Chorus", lyrics: "two", order_index: 1 },
      ],
      existingIds: [],
    });
    expect(first).toHaveLength(2);
    expect(first.every((s) => !!s.id)).toBe(true);

    // Keep the first (edited), drop the second, add a third.
    const second = sections.save({
      table: "song_sections",
      parentColumn: "song_id",
      parentId: song.id,
      sections: [
        { id: first[0].id, type: "verse", title: "Verse 1", lyrics: "edited", order_index: 0 },
        { type: "bridge", title: "Bridge", lyrics: "three", order_index: 1 },
      ],
      existingIds: first.map((s) => s.id),
    });

    expect(second).toHaveLength(2);
    expect(second[0].id).toBe(first[0].id);
    expect(second[0].lyrics).toBe("edited");
    expect(second[1].type).toBe("bridge");
    expect(second.map((s) => s.id)).not.toContain(first[1].id);
  });

  it("refuses to write any table but song_sections", () => {
    const song = songs.create(form("Guarded"), null);
    expect(() =>
      sections.save({
        table: "hymn_templates",
        parentColumn: "song_id",
        parentId: song.id,
        sections: [],
        existingIds: [],
      }),
    ).toThrow(/Refusing to write/);
  });
});

describe("library.addToChurch", () => {
  /**
   * Every shipped template is in the hymnal from the first launch, so a test
   * that needs an unadded one has to make it. The path is still exercised
   * because it is what a future release adding hymns to the seed will use.
   */
  function unaddedTemplate(): string {
    const db = openDb();
    const id = "test-template-" + randomUUID();
    const ts = new Date().toISOString();
    db.prepare(
      `insert into hymn_templates
         (id, title, author, composer, category, key, tempo, description,
          status, is_starter, copyright_status, order_index, created_at, updated_at, updated_by)
       values (?, 'A Later Addition', null, null, null, null, null, null,
               'published', 0, 'public_domain', 9999, ?, ?, null)`,
    ).run(id, ts, ts);
    db.prepare(
      `insert into hymn_template_sections (id, template_id, type, title, lyrics, order_index)
       values (?, ?, 'verse', 'Verse 1', 'words', 0)`,
    ).run(randomUUID(), id);
    return id;
  }

  it("copies the template and its stanzas into the hymnal", () => {
    const templateId = unaddedTemplate();

    const song = library.addToChurch(templateId);
    expect(song.source_template_id).toBe(templateId);
    expect(songs.get(song.id).sections).toHaveLength(1);
  });

  it("reports a second add as ALREADY_IN_HYMNAL rather than a SQL error", () => {
    const [added] = library.addedTemplateIds();

    // This is the branch SongLibraryPage relies on: the renderer turns the
    // code back into AlreadyInHymnalError.
    try {
      library.addToChurch(added);
      expect.unreachable("a duplicate add should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(OpError);
      expect((err as OpError).code).toBe("ALREADY_IN_HYMNAL");
    }
  });

  it("leaves no half-written song behind when the add is rejected", () => {
    const [added] = library.addedTemplateIds();
    const before = songs.list().length;
    expect(() => library.addToChurch(added)).toThrow();
    expect(songs.list()).toHaveLength(before);
  });
});

describe("worship sets", () => {
  it("keeps the service order, and re-nests the song columns the UI reads", () => {
    const set = sets.create("Sunday Morning", "First service");
    const picks = songs.picker().slice(0, 3);

    sets.saveItems(
      set.id,
      picks.map((s) => s.id),
    );

    const { items } = sets.get(set.id);
    expect(items.map((i) => i.song_id)).toEqual(picks.map((s) => s.id));
    expect(items.map((i) => i.order_index)).toEqual([0, 1, 2]);
    expect(items[0].song.title).toBe(picks[0].title);
  });

  it("replaces the whole list on a reorder rather than appending", () => {
    const set = sets.create("Evening", "");
    const picks = songs.picker().slice(0, 3);

    sets.saveItems(set.id, [picks[0].id, picks[1].id]);
    sets.saveItems(set.id, [picks[1].id, picks[0].id, picks[2].id]);

    const { items } = sets.get(set.id);
    expect(items.map((i) => i.song_id)).toEqual([picks[1].id, picks[0].id, picks[2].id]);
  });

  it("counts its items for the list page", () => {
    const set = sets.create("Counted", "");
    sets.saveItems(
      set.id,
      songs.picker().slice(0, 2).map((s) => s.id),
    );
    const listed = sets.list().find((s) => s.id === set.id);
    expect(listed?.item_count).toBe(2);
  });
});

describe("church and profile", () => {
  it("saves a partial patch without clearing the other column", () => {
    const before = church.get();
    church.update({ accent_color: "#123456" });

    const after = church.get();
    expect(after.accent_color).toBe("#123456");
    expect(after.name).toBe(before.name);
  });

  it("starts un-onboarded so the tour runs once, then remembers", () => {
    expect(profile.get().onboarding_completed).toBe(false);
    profile.update({ onboarding_completed: true });
    expect(profile.get().onboarding_completed).toBe(true);
  });
});

describe("dashboard.stats", () => {
  it("counts what is actually in this church", () => {
    const stats = dashboard.stats();
    expect(stats.totalSongs).toBe(songs.list().length);
    expect(stats.totalSets).toBe(sets.list().length);
    expect(stats.recentSongs.length).toBeLessThanOrEqual(5);
  });
});
