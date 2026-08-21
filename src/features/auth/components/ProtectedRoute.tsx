import { useEffect, type ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { toast } from "sonner";
import { useAuthStore } from "@/stores/auth-store";
import type { UserRole } from "@/types/database";
import { LoadingScreen } from "@/components/layout/LoadingScreen";

interface ProtectedRouteProps {
  children: ReactNode;
  requireRole?: UserRole;
  /**
   * Whether the user must have completed onboarding (i.e. have a church)
   * to view this route. Defaults to true; set to false for /onboarding
   * itself, which is where a church gets created.
   */
  requireChurch?: boolean;
}

export function ProtectedRoute({
  children,
  requireRole,
  requireChurch = true,
}: ProtectedRouteProps) {
  const { status, profile } = useAuthStore();
  const location = useLocation();
  // A superadmin sits outside the tenant model and has no church, so every
  // route this guard wraps is a church route they don't belong on.
  const isSuperadmin = status === "authenticated" && profile?.role === "superadmin";
  const needsOnboarding =
    status === "authenticated" && requireChurch && !isSuperadmin && !profile?.church_id;
  const isUnauthorized =
    status === "authenticated" &&
    !needsOnboarding &&
    !!requireRole &&
    profile?.role !== requireRole;

  useEffect(() => {
    if (isUnauthorized) {
      toast.error("You don't have access to that. Ask an admin for help.");
    }
  }, [isUnauthorized]);

  if (status === "loading") {
    return <LoadingScreen />;
  }

  if (status === "unauthenticated") {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  }

  // Send them home rather than merely letting them through: OAuth and email
  // verification both land on /dashboard via `redirectTo`, so a superadmin
  // would otherwise sit on a church dashboard with no church behind it.
  if (isSuperadmin) {
    return <Navigate to="/superadmin" replace />;
  }

  if (needsOnboarding) {
    return <Navigate to="/onboarding" replace />;
  }

  if (isUnauthorized) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}
