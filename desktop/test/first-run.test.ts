import { describe, expect, it } from "vitest";
import path from "node:path";
import Database from "better-sqlite3";
import { migrate } from "../src/main/db/migrate";
import { seedIfEmpty } from "../src/main/db/seed";

const HYMNAL_SEED = path.resolve(import.meta.dirname, "../resources/hymnal-seed.json");

function readFlag(db: Database.Database, key: string): string | null {
  const row = db.prepare("select value from app_settings where key = ?").get(key) as
    | { value: string | null }
    | undefined;
  return row?.value ?? null;
}

/**
 * Who gets shown the first-run wizard.
 *
 * The whole question is one flag, and both ways of getting it wrong are bad in
 * a way nobody would report as a bug: a fresh install that skips setup opens a
 * dashboard belonging to "My Church", and an upgraded install that does NOT
 * skip it interrogates somebody who has been running services on this app for
 * a year. So both paths are exercised against a real database here.
 */
describe("first-run setup flag", () => {
  it("is unset on a fresh install, so the wizard runs", () => {
    const db = new Database(":memory:");
    db.pragma("foreign_keys = ON");

    // Exactly the order main/index.ts uses: migrate, then seed.
    migrate(db);
    seedIfEmpty(db, HYMNAL_SEED);

    expect(readFlag(db, "profile.setup_completed")).toBeNull();
    db.close();
  });

  it("is set on an install upgrading from 1.0.1, so the wizard does not", () => {
    const db = new Database(":memory:");
    db.pragma("foreign_keys = ON");

    // Build a 1.0.1 install: migrations through version 2, already seeded.
    db.pragma("user_version = 0");
    migrate(db);
    seedIfEmpty(db, HYMNAL_SEED);
    // Rewind to what 1.0.1 shipped, keeping the data that install would have.
    db.pragma("user_version = 2");
    db.prepare("delete from app_settings where key = 'profile.setup_completed'").run();

    expect(readFlag(db, "profile.setup_completed")).toBeNull();

    // Now upgrade.
    migrate(db);

    expect(readFlag(db, "profile.setup_completed")).toBe("true");
    db.close();
  });

  it("leaves a finished wizard finished when migrations re-run", () => {
    const db = new Database(":memory:");
    db.pragma("foreign_keys = ON");
    migrate(db);
    seedIfEmpty(db, HYMNAL_SEED);

    db.prepare(
      `insert into app_settings (key, value) values ('profile.setup_completed', 'true')
       on conflict(key) do update set value = excluded.value`,
    ).run();

    migrate(db);

    expect(readFlag(db, "profile.setup_completed")).toBe("true");
    db.close();
  });
});
