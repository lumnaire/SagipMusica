import { supabase } from "@/lib/supabase/client";
import type { PlatformUpdate } from "@/types/database";

/**
 * The "what's coming" board (migration 0016).
 *
 * Two audiences share one table. The download page reads it signed out with
 * the anon key and sees only published rows; the superadmin dashboard reads
 * and writes all of it. Neither needs a separate endpoint -- RLS is what
 * separates them, so these are plain table queries rather than RPCs.
 */

/** Published rows, newest first. Safe to call signed out. */
export async function fetchPublishedUpdates(): Promise<PlatformUpdate[]> {
  const { data, error } = await supabase
    .from("platform_updates")
    .select("*")
    .eq("is_published", true)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as PlatformUpdate[];
}

/**
 * Everything on the board, drafts included. Returns only published rows for
 * anyone who is not the superadmin -- the select policy decides, not this
 * filter's absence.
 */
export async function fetchAllUpdates(): Promise<PlatformUpdate[]> {
  const { data, error } = await supabase
    .from("platform_updates")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as PlatformUpdate[];
}

export async function createUpdate(
  title: string,
  detail: string | null,
): Promise<PlatformUpdate> {
  // created_by is stamped by a trigger; sending it here would be rejected
  // anyway, and the client has no business naming an author.
  const { data, error } = await supabase
    .from("platform_updates")
    .insert({ title, detail })
    .select()
    .single();
  if (error) throw error;
  return data as PlatformUpdate;
}

export async function setUpdatePublished(
  id: string,
  isPublished: boolean,
): Promise<void> {
  const { error } = await supabase
    .from("platform_updates")
    .update({ is_published: isPublished })
    .eq("id", id);
  if (error) throw error;
}

export async function deleteUpdate(id: string): Promise<void> {
  const { error } = await supabase.from("platform_updates").delete().eq("id", id);
  if (error) throw error;
}
