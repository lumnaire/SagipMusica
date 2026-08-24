import { supabase } from "@/lib/supabase/client";
import { DESKTOP_VERSION } from "./download-info";

/**
 * A survey answer, or the absence of one.
 *
 * A visitor is somebody who told us they are not with a church -- a pastor
 * looking at it for a congregation they have not joined, a student, anyone
 * curious. They are recorded rather than skipped: how many downloads come from
 * outside a church is worth knowing, and it keeps invented church names out of
 * the numbers that matter.
 */
export type DownloadSignup =
  | { type: "church"; churchName: string; churchLocation: string }
  | { type: "visitor" };

/**
 * Records who is installing the desktop app (see migration 0014).
 *
 * Written with the anon key -- the download page is public and the desktop app
 * has no accounts -- so the row is insert-only and nothing comes back. The
 * caller is expected to start the download whether this resolves or rejects: a
 * survey answer is never worth withholding somebody's installer over.
 */
export async function recordDownloadSignup(signup: DownloadSignup): Promise<void> {
  const { error } = await supabase.from("download_signups").insert({
    app_version: DESKTOP_VERSION,
    platform: "windows",
    signup_type: signup.type,
    // Left off entirely for a visitor. The database rejects a visitor row that
    // carries a church name, so this is not merely tidiness.
    ...(signup.type === "church"
      ? {
          church_name: signup.churchName,
          church_location: signup.churchLocation,
        }
      : {}),
  });
  if (error) throw error;
}
