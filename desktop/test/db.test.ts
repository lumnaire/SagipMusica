import { beforeAll, describe, expect, it } from "vitest";
import path from "node:path";
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

describe("seed", () => {
  it("creates the one church and stocks the hymnal with the starters", () => {
    expect(church.get().id).toBe(LOCAL_CHURCH_ID);
    // 0008's twenty starter hymns, copied in the way signup does in the
    // hosted app, so a fresh install is not an empty screen.
    expect(songs.list()).toHaveLength(20);
    expect(library.list().length).toBeGreaterThan(300);
  });

  it("marks the starters as already added, so the library page agrees", () => {
    expect(library.addedTemplateIds()).toHaveLength(20);
  });

  it("does not run twice", () => {
    expect(seedIfEmpty(openDb(), SEED)).toBe(false);
    expect(songs.list()).toHaveLength(20);
  });

  it("gives every starter its stanzas", () => {
    const [first] = songs.list();
    expect(songs.get(first.id).sections.length).toBeGreaterThan(0);
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
  it("copies the template and its stanzas into the hymnal", () => {
    const entry = library.list().find((t) => !library.addedTemplateIds().includes(t.id));
    expect(entry).toBeDefined();

    const song = library.addToChurch(entry!.id);
    expect(song.source_template_id).toBe(entry!.id);
    expect(songs.get(song.id).sections).toHaveLength(entry!.section_count);
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
