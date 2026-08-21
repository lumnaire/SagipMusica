import { useEffect } from "react";
import { BrowserRouter } from "react-router-dom";
import { Toaster } from "@/components/ui/sonner";
import { AppRoutes } from "@/routes/AppRoutes";
import { useAuthStore } from "@/stores/auth-store";
import { useChurchStore } from "@/stores/church-store";
import { CookieBanner } from "@/features/legal/components/CookieBanner";
import { startPresence, stopPresence } from "@/lib/presence";

function App() {
  const initialize = useAuthStore((s) => s.initialize);
  const churchId = useAuthStore((s) => s.profile?.church_id);
  const userId = useAuthStore((s) => s.session?.user.id);
  const loadChurch = useChurchStore((s) => s.loadChurch);
  const clearChurch = useChurchStore((s) => s.clear);

  useEffect(() => {
    initialize();
  }, [initialize]);

  useEffect(() => {
    if (churchId) {
      loadChurch(churchId);
    } else {
      clearChurch();
    }
  }, [churchId, loadChurch, clearChurch]);

  // Announce this session on the shared presence channel so the superadmin
  // dashboard can count who is online. Stops on sign-out.
  useEffect(() => {
    if (userId) {
      startPresence(userId);
    } else {
      stopPresence();
    }
    return () => stopPresence();
  }, [userId]);

  return (
    <BrowserRouter>
      <AppRoutes />
      <CookieBanner />
      <Toaster />
    </BrowserRouter>
  );
}

export default App;
