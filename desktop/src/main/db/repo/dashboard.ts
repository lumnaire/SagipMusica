import type { Song } from "@/types/database";
import type { DashboardStats } from "@shared/contract";
import { getDb } from "../connection";
import { LOCAL_CHURCH_ID } from "../ids";

export function stats(): DashboardStats {
  const db = getDb();
  const one = (sql: string, ...args: unknown[]) =>
    (db.prepare(sql).get(...args) as { n: number }).n;

  return {
    totalSongs: one("select count(*) as n from songs where church_id = ?", LOCAL_CHURCH_ID),
    totalHymns: one(
      "select count(*) as n from songs where church_id = ? and category = 'Hymn'",
      LOCAL_CHURCH_ID,
    ),
    totalSets: one("select count(*) as n from worship_sets where church_id = ?", LOCAL_CHURCH_ID),
    recentSongs: db
      .prepare("select * from songs where church_id = ? order by created_at desc limit 5")
      .all(LOCAL_CHURCH_ID) as Song[],
  };
}
