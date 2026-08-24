import { randomUUID } from "node:crypto";

/**
 * The single tenant this install represents. The schema keeps `church_id`
 * everywhere so the reused UI and src/types/database.ts are unchanged; on the
 * desktop there is simply only ever one value for it.
 */
export const LOCAL_CHURCH_ID = "00000000-0000-0000-0000-000000000001";

/** Stands in for the Supabase auth user id on a machine with no accounts. */
export const LOCAL_PROFILE_ID = "00000000-0000-0000-0000-000000000002";

export const newId = (): string => randomUUID();
