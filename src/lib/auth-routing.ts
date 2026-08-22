import type { Profile } from "@/types/database";

/**
 * Roles that live outside the tenant model. They have no church by design, so
 * the usual "no church_id means go and onboard" rule would trap them in the
 * onboarding flow forever — each gets its own landing area instead.
 */
export const PLATFORM_ROLES = ["superadmin", "encoder"] as const;

export function isPlatformRole(profile: Profile | null): boolean {
  return (
    !!profile && (PLATFORM_ROLES as readonly string[]).includes(profile.role)
  );
}

/**
 * Where a signed-in user belongs. Kept in one place because three routes
 * (RootRoute, LoginPage, SignupPage) all have to agree.
 */
export function landingPathFor(profile: Profile | null): string {
  if (profile?.role === "superadmin") return "/superadmin";
  if (profile?.role === "encoder") return "/encoder";
  if (!profile?.church_id) return "/onboarding";
  return "/dashboard";
}
