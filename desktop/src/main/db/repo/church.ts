import type { Church } from "@/types/database";
import { getDb, nowIso } from "../connection";
import { LOCAL_CHURCH_ID } from "../ids";

export function get(): Church {
  const row = getDb().prepare("select * from churches where id = ?").get(LOCAL_CHURCH_ID) as
    | Church
    | undefined;
  if (!row) throw new Error("Church row missing — the database was not seeded.");
  return row;
}

export function update(patch: { name?: string; accent_color?: string }): void {
  const fields: string[] = [];
  const values: unknown[] = [];
  if (patch.name !== undefined) {
    fields.push("name = ?");
    values.push(patch.name);
  }
  if (patch.accent_color !== undefined) {
    fields.push("accent_color = ?");
    values.push(patch.accent_color);
  }
  if (fields.length === 0) return;

  fields.push("updated_at = ?");
  values.push(nowIso(), LOCAL_CHURCH_ID);
  getDb()
    .prepare(`update churches set ${fields.join(", ")} where id = ?`)
    .run(...values);
}
