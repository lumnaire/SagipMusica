import { supabase } from "@/lib/supabase/client";
import type { Song } from "@/types/database";

export interface DashboardStats {
  totalSongs: number;
  totalHymns: number;
  totalSets: number;
  recentSongs: Song[];
}

/**
 * The four numbers the dashboard opens with. Counts use `head: true` so only
 * the count comes back over the wire, not the rows themselves, and all four
 * queries go out together rather than in series.
 */
export async function fetchDashboardStats(): Promise<DashboardStats> {
  const [songsCount, hymnsCount, setsCount, recent] = await Promise.all([
    supabase.from("songs").select("*", { count: "exact", head: true }),
    supabase.from("songs").select("*", { count: "exact", head: true }).eq("category", "Hymn"),
    supabase.from("worship_sets").select("*", { count: "exact", head: true }),
    supabase.from("songs").select("*").order("created_at", { ascending: false }).limit(5),
  ]);

  return {
    totalSongs: songsCount.count ?? 0,
    totalHymns: hymnsCount.count ?? 0,
    totalSets: setsCount.count ?? 0,
    recentSongs: (recent.data ?? []) as Song[],
  };
}

/** Flips the flag that stops the onboarding tour running a second time. */
export async function markOnboardingComplete(profileId: string): Promise<void> {
  await supabase.from("profiles").update({ onboarding_completed: true }).eq("id", profileId);
}
