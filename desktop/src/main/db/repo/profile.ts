import type { LocalProfile } from "@shared/contract";
import { getDb } from "../connection";
import { LOCAL_CHURCH_ID, LOCAL_PROFILE_ID } from "../ids";

const KEY_NAME = "profile.name";
const KEY_ONBOARDED = "profile.onboarding_completed";
const KEY_SETUP = "profile.setup_completed";

function read(key: string): string | null {
  const row = getDb().prepare("select value from app_settings where key = ?").get(key) as
    | { value: string | null }
    | undefined;
  return row?.value ?? null;
}

function write(key: string, value: string): void {
  getDb()
    .prepare(
      `insert into app_settings (key, value) values (?, ?)
       on conflict(key) do update set value = excluded.value`,
    )
    .run(key, value);
}

/**
 * The desktop stand-in for a Supabase `profiles` row. There are no accounts on
 * this build, so the identity is local and fixed — only the display name and
 * the "has the tour run" flag are real state.
 */
export function get(): LocalProfile {
  return {
    id: LOCAL_PROFILE_ID,
    church_id: LOCAL_CHURCH_ID,
    email: "",
    name: read(KEY_NAME),
    onboarding_completed: read(KEY_ONBOARDED) === "true",
    setup_completed: read(KEY_SETUP) === "true",
  };
}

export function update(patch: {
  name?: string;
  onboarding_completed?: boolean;
  setup_completed?: boolean;
}): void {
  if (patch.name !== undefined) write(KEY_NAME, patch.name);
  if (patch.onboarding_completed !== undefined) {
    write(KEY_ONBOARDED, patch.onboarding_completed ? "true" : "false");
  }
  if (patch.setup_completed !== undefined) {
    write(KEY_SETUP, patch.setup_completed ? "true" : "false");
  }
}
