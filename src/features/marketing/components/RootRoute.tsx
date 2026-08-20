import { Navigate } from "react-router-dom";
import { useAuthStore } from "@/stores/auth-store";
import { LoadingScreen } from "@/components/layout/LoadingScreen";
import { LandingPage } from "./LandingPage";

export function RootRoute() {
  const { status, profile } = useAuthStore();

  if (status === "loading") {
    return <LoadingScreen />;
  }

  if (status === "authenticated") {
    return <Navigate to={profile?.church_id ? "/dashboard" : "/onboarding"} replace />;
  }

  return <LandingPage />;
}
