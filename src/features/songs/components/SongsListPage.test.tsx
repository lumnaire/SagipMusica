import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { createSupabaseMock } from "@/test/supabaseMock";
import { useAuthStore } from "@/stores/auth-store";
import { SongsListPage } from "./SongsListPage";
import type { Profile } from "@/types/database";

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

vi.mock("@/lib/supabase/client", () => ({
  supabase: createSupabaseMock({
    songs: {
      data: [
        {
          id: "song-1",
          title: "Amazing Grace",
          author: "John Newton",
          composer: null,
          category: "Hymn",
          key: "G",
          tempo: null,
          description: null,
          created_at: "2024-01-01T00:00:00Z",
          updated_at: "2024-01-02T00:00:00Z",
          song_sections: [{ count: 3 }],
        },
      ],
      error: null,
    },
  }),
  MEDIA_BUCKET: "presentation-media",
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
    <MemoryRouter initialEntries={["/songs"]}>
      <SongsListPage />
    </MemoryRouter>,
  );
}

describe("SongsListPage role-gating", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("hides song-management actions from a presenter", async () => {
    setAuthProfile("presenter");
    renderPage();

    await screen.findByText("Amazing Grace");

    expect(screen.queryByRole("button", { name: /add song/i })).not.toBeInTheDocument();
    expect(screen.queryByTitle("Edit")).not.toBeInTheDocument();
    expect(screen.queryByTitle("Delete")).not.toBeInTheDocument();

    // Presenters can still preview and present songs.
    expect(screen.getByTitle("Preview")).toBeInTheDocument();
    expect(screen.getByTitle("Present")).toBeInTheDocument();
  });

  it("shows song-management actions to an admin", async () => {
    setAuthProfile("admin");
    renderPage();

    await screen.findByText("Amazing Grace");

    expect(screen.getByRole("button", { name: /add song/i })).toBeInTheDocument();
    expect(screen.getByTitle("Edit")).toBeInTheDocument();
    expect(screen.getByTitle("Delete")).toBeInTheDocument();
  });
});
