import { type ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuthStore } from "@/stores/auth-store";
import { LoadingScreen } from "@/components/layout/LoadingScreen";
import { landingPathFor } from "@/lib/auth-routing";

/**
 * Song-encoder gate. Separate from ProtectedRoute for the same reason
 * SuperAdminRoute is: an encoder has no church, so the church check there
 * would bounce them to onboarding.
 *
 * This is a convenience guard only — the real enforcement is the is_encoder()
 * RLS policies on hymn_templates. Anyone editing local state to reach this page
 * sees an empty catalog and gets rejected on every write.
 */
export function EncoderRoute({ children }: { children: ReactNode }) {
  const { status, profile } = useAuthStore();
  const location = useLocation();

  if (status === "loading") return <LoadingScreen />;

  if (status === "unauthenticated") {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  }

  if (profile?.role !== "encoder") {
    return <Navigate to={landingPathFor(profile)} replace />;
  }

  return <>{children}</>;
}
