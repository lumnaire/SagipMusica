import type { DashboardStats } from "@shared/contract";
import { invoke } from "./invoke";

export type { DashboardStats };

/** Desktop stand-in for src/features/dashboard/api.ts. */

export function fetchDashboardStats(): Promise<DashboardStats> {
  return invoke("dashboard.stats");
}

/**
 * Flips the flag that stops the onboarding tour running a second time.
 *
 * The profile id is ignored: this machine has exactly one local profile, and
 * the flag lives in `app_settings`. The parameter is kept so the signature
 * still matches the module this stands in for.
 */
export async function markOnboardingComplete(_profileId: string): Promise<void> {
  await invoke("profile.update", { patch: { onboarding_completed: true } });
}
