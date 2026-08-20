import { Routes, Route, Navigate } from "react-router-dom";
import { RootRoute } from "@/features/marketing/components/RootRoute";
import { LoginPage } from "@/features/auth/components/LoginPage";
import { SignupPage } from "@/features/auth/components/SignupPage";
import { ProtectedRoute } from "@/features/auth/components/ProtectedRoute";
import { OnboardingPage } from "@/features/onboarding/components/OnboardingPage";
import { DashboardPage } from "@/features/dashboard/components/DashboardPage";
import { SettingsPage } from "@/features/dashboard/components/SettingsPage";
import { SongsListPage } from "@/features/songs/components/SongsListPage";
import { SongPreviewPage } from "@/features/songs/components/SongPreviewPage";
import { SongEditorPage } from "@/features/song-editor/components/SongEditorPage";
import { WorshipSetsListPage } from "@/features/worship-sets/components/WorshipSetsListPage";
import { WorshipSetEditorPage } from "@/features/worship-sets/components/WorshipSetEditorPage";
import { PresenterView } from "@/features/presentation/components/PresenterView";
import { ProjectorView } from "@/features/presentation/components/ProjectorView";

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<RootRoute />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/signup" element={<SignupPage />} />

      <Route
        path="/onboarding"
        element={
          <ProtectedRoute requireChurch={false}>
            <OnboardingPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <DashboardPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/songs"
        element={
          <ProtectedRoute>
            <SongsListPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/songs/new"
        element={
          <ProtectedRoute requireRole="admin">
            <SongEditorPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/songs/:id"
        element={
          <ProtectedRoute>
            <SongPreviewPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/songs/:id/edit"
        element={
          <ProtectedRoute requireRole="admin">
            <SongEditorPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/sets"
        element={
          <ProtectedRoute>
            <WorshipSetsListPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/sets/new"
        element={
          <ProtectedRoute>
            <WorshipSetEditorPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/sets/:id"
        element={
          <ProtectedRoute>
            <WorshipSetEditorPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/presentation/:sessionId"
        element={
          <ProtectedRoute>
            <PresenterView />
          </ProtectedRoute>
        }
      />
      {/* Public: the projector window only listens on BroadcastChannel, it never
          talks to Supabase, so it does not require an authenticated session. */}
      <Route path="/presentation/:sessionId/projector" element={<ProjectorView />} />

      <Route
        path="/settings"
        element={
          <ProtectedRoute>
            <SettingsPage />
          </ProtectedRoute>
        }
      />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
