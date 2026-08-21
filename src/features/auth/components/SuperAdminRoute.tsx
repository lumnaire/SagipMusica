import { type ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuthStore } from "@/stores/auth-store";
import { LoadingScreen } from "@/components/layout/LoadingScreen";
import { landingPathFor } from "@/lib/auth-routing";

/**
 * Platform-operator gate. Separate from ProtectedRoute because a superadmin
 * has no church, so the church check there would bounce them to onboarding.
 *
 * This is a convenience guard only — the real enforcement is server-side in
 * the superadmin_* SECURITY DEFINER functions, which re-check the role
 * themselves. Anyone editing local state to reach this page sees an empty
 * dashboard and "Not authorised" errors.
 */
export function SuperAdminRoute({ children }: { children: ReactNode }) {
  const { status, profile } = useAuthStore();
  const location = useLocation();

  if (status === "loading") return <LoadingScreen />;

  if (status === "unauthenticated") {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  }

  if (profile?.role !== "superadmin") {
    return <Navigate to={landingPathFor(profile)} replace />;
  }

  return <>{children}</>;
}
