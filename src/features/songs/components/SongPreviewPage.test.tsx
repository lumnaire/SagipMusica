import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { useAuthStore } from "@/stores/auth-store";
import { SongPreviewPage } from "./SongPreviewPage";
import type { Profile } from "@/types/database";

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

vi.mock("@/features/presentation/engine/loadPresentation", () => ({
  loadSongSlides: vi.fn().mockResolvedValue({ title: "Amazing Grace", slides: [] }),
}));

function setAuthProfile(role: Profile["role"]) {
  useAuthStore.setState({
    status: "authenticated",
    session: { user: { email: "test@church.org" } } as never,
    profile: { id: "u1", email: "test@church.org", name: "Test User", role } as Profile,
  });
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/songs/song-1"]}>
      <Routes>
        <Route path="/songs/:id" element={<SongPreviewPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("SongPreviewPage role-gating", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("hides the Edit button from a presenter but keeps Present", async () => {
    setAuthProfile("presenter");
    renderPage();

    await screen.findByText("Amazing Grace");

    expect(screen.queryByRole("button", { name: /^edit$/i })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /present/i })).toBeInTheDocument();
  });

  it("shows the Edit button to an admin", async () => {
    setAuthProfile("admin");
    renderPage();

    await screen.findByText("Amazing Grace");

    expect(screen.getByRole("button", { name: /^edit$/i })).toBeInTheDocument();
  });
});
