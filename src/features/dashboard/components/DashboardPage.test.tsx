import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { createSupabaseMock } from "@/test/supabaseMock";
import { useAuthStore } from "@/stores/auth-store";
import { DashboardPage } from "./DashboardPage";
import type { Profile } from "@/types/database";

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

vi.mock("@/lib/supabase/client", () => ({
  supabase: createSupabaseMock({
    // Non-empty so the "Recent Songs" empty-state (which has its own,
    // separately-gated "Add Song" button) doesn't also render and create
    // a second match for the quick-actions button in these assertions.
    songs: {
      data: [
        {
          id: "song-1",
          title: "Amazing Grace",
          author: "John Newton",
          category: "Hymn",
          created_at: "2024-01-01T00:00:00Z",
        },
      ],
      count: 1,
      error: null,
    },
    worship_sets: { data: [], count: 0, error: null },
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
    <MemoryRouter initialEntries={["/dashboard"]}>
      <DashboardPage />
    </MemoryRouter>,
  );
}

describe("DashboardPage role-gating", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("hides 'Add Song' from a presenter but keeps worship-set/presentation actions", async () => {
    setAuthProfile("presenter");
    renderPage();

    await screen.findByText(/quick actions/i);

    expect(screen.queryByRole("button", { name: /add song/i })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /create worship set/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /start presentation/i })).toBeInTheDocument();
  });

  it("shows 'Add Song' to an admin", async () => {
    setAuthProfile("admin");
    renderPage();

    await screen.findByText(/quick actions/i);

    expect(screen.getByRole("button", { name: /add song/i })).toBeInTheDocument();
  });
});
