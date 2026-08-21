import { Navigate } from "react-router-dom";
import { useAuthStore } from "@/stores/auth-store";
import { LoadingScreen } from "@/components/layout/LoadingScreen";
import { landingPathFor } from "@/lib/auth-routing";
import { LandingPage } from "./LandingPage";

export function RootRoute() {
  const { status, profile } = useAuthStore();

  if (status === "loading") {
    return <LoadingScreen />;
  }

  if (status === "authenticated") {
    return <Navigate to={landingPathFor(profile)} replace />;
  }

  return <LandingPage />;
}
