import { supabase } from "@/lib/supabase/client";
import type { SubscriptionTier, UserRole } from "@/types/database";

export interface PlatformStats {
  total_accounts: number;
  total_churches: number;
  total_songs: number;
  total_worship_sets: number;
  total_library_songs: number;
  /** Rows in download_signups -- installers handed out, not distinct churches. */
  total_desktop_downloads: number;
  total_pro_accounts: number;
  /** The 3-Text Hunt: accounts that joined, and accounts that finished it. */
  event_participants: number;
  event_completions: number;
}

/** The only transitions superadmin_set_role accepts. */
export type AssignableRole = "presenter" | "encoder";

export interface PlatformAccount {
  id: string;
  email: string;
  name: string | null;
  role: UserRole;
  subscription: SubscriptionTier;
  church_id: string | null;
  church_name: string | null;
  onboarding_completed: boolean;
  created_at: string;
  last_sign_in_at: string | null;
  email_confirmed_at: string | null;
}

// Each of these is a SECURITY DEFINER function that re-checks is_superadmin()
// server-side, so a non-superadmin calling them directly gets "Not authorised"
// rather than data. See supabase/migrations/0011_superadmin.sql.

export async function fetchPlatformStats(): Promise<PlatformStats> {
  const { data, error } = await supabase.rpc("superadmin_stats");
  if (error) throw error;
  return data as unknown as PlatformStats;
}

export async function fetchPlatformAccounts(): Promise<PlatformAccount[]> {
  const { data, error } = await supabase.rpc("superadmin_list_accounts");
  if (error) throw error;
  return (data ?? []) as PlatformAccount[];
}

export async function deletePlatformAccount(targetId: string): Promise<void> {
  const { error } = await supabase.rpc("superadmin_delete_user", {
    target_id: targetId,
  });
  if (error) throw error;
}

/**
 * Only presenter <-> encoder. `admin` is earned by creating a church, and
 * `superadmin` stays SQL-only — the function rejects anything else, along with
 * any account that already belongs to a church.
 */
export async function setAccountRole(
  targetId: string,
  role: AssignableRole,
): Promise<void> {
  const { error } = await supabase.rpc("superadmin_set_role", {
    target_id: targetId,
    new_role: role,
  });
  if (error) throw error;
}
