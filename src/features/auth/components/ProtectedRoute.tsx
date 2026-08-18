import { useEffect, type ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { toast } from "sonner";
import { useAuthStore } from "@/stores/auth-store";
import type { UserRole } from "@/types/database";
import { Music } from "lucide-react";

interface ProtectedRouteProps {
  children: ReactNode;
  requireRole?: UserRole;
}

export function ProtectedRoute({ children, requireRole }: ProtectedRouteProps) {
  const { status, profile } = useAuthStore();
  const location = useLocation();
  const isUnauthorized =
    status === "authenticated" && !!requireRole && profile?.role !== requireRole;

  useEffect(() => {
    if (isUnauthorized) {
      toast.error("You don't have access to that. Ask an admin for help.");
    }
  }, [isUnauthorized]);

  if (status === "loading") {
    return (
      <div className="flex min-h-svh items-center justify-center bg-muted/40">
        <div className="flex flex-col items-center gap-3 text-muted-foreground">
          <Music className="h-8 w-8 animate-pulse text-primary" />
          <p className="text-sm">Loading...</p>
        </div>
      </div>
    );
  }

  if (status === "unauthenticated") {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  }

  if (isUnauthorized) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}
