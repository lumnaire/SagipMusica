import { useEffect } from "react";
import { BrowserRouter } from "react-router-dom";
import { Toaster } from "@/components/ui/sonner";
import { AppRoutes } from "@/routes/AppRoutes";
import { useAuthStore } from "@/stores/auth-store";
import { useChurchStore } from "@/stores/church-store";

function App() {
  const initialize = useAuthStore((s) => s.initialize);
  const churchId = useAuthStore((s) => s.profile?.church_id);
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

  return (
    <BrowserRouter>
      <AppRoutes />
      <Toaster />
    </BrowserRouter>
  );
}

export default App;
