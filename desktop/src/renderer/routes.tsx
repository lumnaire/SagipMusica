import { Routes, Route, Navigate } from "react-router-dom";
import { DashboardPage } from "@/features/dashboard/components/DashboardPage";
import { SongsListPage } from "@/features/songs/components/SongsListPage";
import { SongPreviewPage } from "@/features/songs/components/SongPreviewPage";
import { SongEditorPage } from "@/features/song-editor/components/SongEditorPage";
import { WorshipSetsListPage } from "@/features/worship-sets/components/WorshipSetsListPage";
import { WorshipSetEditorPage } from "@/features/worship-sets/components/WorshipSetEditorPage";
import { BiblePage } from "@/features/bible/components/BiblePage";
import { PresenterView } from "@/features/presentation/components/PresenterView";
import { ProjectorView } from "@/features/presentation/components/ProjectorView";
import { SettingsPage } from "./pages/SettingsPage";

/**
 * The desktop route table.
 *
 * The same pages as src/routes/AppRoutes.tsx, with everything that assumes a
 * server removed: no marketing site, no login or signup, no onboarding, no
 * encoder or superadmin areas — and no ProtectedRoute wrappers, because there
 * is no session to protect. The database is a file this user already owns.
 *
 * /songs/library is gone too, for a different reason: it is not that it cannot
 * work offline, it is that it has nothing left to offer. The installer carries
 * the whole library and the first launch copies all of it into the hymnal, so
 * the catalog and the hymnal hold the same songs (see main/db/seed.ts).
 *
 * Paths are kept identical to the web build so every navigate() and <Link> in
 * the reused pages still lands where it means to.
 */
export function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/dashboard" replace />} />

      <Route path="/dashboard" element={<DashboardPage />} />

      <Route path="/songs" element={<SongsListPage />} />
      <Route path="/songs/new" element={<SongEditorPage />} />
      {/* Ahead of /songs/:id for readability — React Router already ranks the
          static segment above the dynamic one. Kept as a redirect rather than
          deleted: an install upgraded from 1.0.0 can still be sitting on this
          path in its restored window state, and the songs are all in /songs
          now anyway. */}
      <Route path="/songs/library" element={<Navigate to="/songs" replace />} />
      <Route path="/songs/:id" element={<SongPreviewPage />} />
      <Route path="/songs/:id/edit" element={<SongEditorPage />} />

      {/* The whole KJV ships in the installer and is read from SQLite, so
          this works with the building's internet switched off. */}
      <Route path="/bible" element={<BiblePage />} />

      <Route path="/sets" element={<WorshipSetsListPage />} />
      <Route path="/sets/new" element={<WorshipSetEditorPage />} />
      <Route path="/sets/:id" element={<WorshipSetEditorPage />} />

      <Route path="/presentation/:sessionId" element={<PresenterView />} />
      <Route path="/presentation/:sessionId/projector" element={<ProjectorView />} />

      <Route path="/settings" element={<SettingsPage />} />

      {/* A stray path should land somewhere useful rather than on the router's
          blank fallback — there is no marketing home to send it to here. */}
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}
