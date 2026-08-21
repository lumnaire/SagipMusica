import type { Profile } from "@/types/database";

/**
 * Where a signed-in user belongs. Kept in one place because three routes
 * (RootRoute, LoginPage, SignupPage) all have to agree, and a superadmin has
 * no church — so the usual "no church_id means go and onboard" rule would
 * trap them in the onboarding flow forever.
 */
export function landingPathFor(profile: Profile | null): string {
  if (profile?.role === "superadmin") return "/superadmin";
  if (!profile?.church_id) return "/onboarding";
  return "/dashboard";
}
