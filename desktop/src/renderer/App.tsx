import { useEffect, useState } from "react";
import { BrowserRouter, useLocation } from "react-router-dom";
import { Toaster } from "@/components/ui/sonner";
import { LoadingScreen } from "@/components/layout/LoadingScreen";
import { useAuthStore } from "@/stores/auth-store";
import { useChurchStore } from "@/stores/church-store";
import { AppRoutes } from "./routes";

/**
 * The projector window is opened by the presenter with window.open() and only
 * ever listens on the presentation channel. It must not wait on the local
 * profile or the church row — those are irrelevant to it, and a slow first
 * read would leave the sanctuary screen showing a spinner.
 */
function isProjectorRoute(pathname: string): boolean {
  return pathname.endsWith("/projector");
}

function Bootstrap({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const initialize = useAuthStore((s) => s.initialize);
  const churchId = useAuthStore((s) => s.profile?.church_id);
  const loadChurch = useChurchStore((s) => s.loadChurch);
  const [ready, setReady] = useState(false);

  const projector = isProjectorRoute(location.pathname);

  useEffect(() => {
    if (projector) {
      setReady(true);
      return;
    }
    // Failing here means the database did not open; there is no offline mode
    // to fall back to, so the app renders anyway and each page surfaces its
    // own error rather than the whole window staying blank.
    initialize()
      .catch((err) => console.error("Failed to load the local profile", err))
      .finally(() => setReady(true));
  }, [initialize, projector]);

  useEffect(() => {
    if (!churchId) return;
    loadChurch(churchId);
  }, [churchId, loadChurch]);

  if (!ready) return <LoadingScreen />;
  return <>{children}</>;
}

export default function App() {
  return (
    <BrowserRouter>
      <Bootstrap>
        <AppRoutes />
      </Bootstrap>
      <Toaster />
    </BrowserRouter>
  );
}
