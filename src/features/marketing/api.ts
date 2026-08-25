import { supabase } from "@/lib/supabase/client";

/** The five counters the hero closes on. See migration 0017. */
export interface PublicStats {
  accounts: number;
  churches: number;
  desktop_downloads: number;
  songs: number;
  worship_sets: number;
}

/**
 * Running totals for the landing page, readable signed out.
 *
 * A SECURITY DEFINER function rather than five count queries: the tables
 * themselves stay closed to anon, and only the aggregate comes back.
 */
export async function fetchPublicStats(): Promise<PublicStats> {
  const { data, error } = await supabase.rpc("public_platform_stats");
  if (error) throw error;
  return data as unknown as PublicStats;
}
