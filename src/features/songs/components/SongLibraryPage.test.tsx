import { render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { createSupabaseMock } from "@/test/supabaseMock";
import { useAuthStore } from "@/stores/auth-store";
import { SongLibraryPage } from "./SongLibraryPage";
import type { Profile } from "@/types/database";

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

function template(id: string, title: string) {
  return {
    id,
    title,
    author: "John Newton",
    composer: null,
    category: "Hymn",
    key: "G",
    tempo: null,
    description: null,
    status: "published",
    is_starter: true,
    copyright_status: "public_domain",
    order_index: 1,
    created_at: "2024-01-01T00:00:00Z",
    updated_at: "2024-01-02T00:00:00Z",
    updated_by: null,
    hymn_template_sections: [{ count: 4 }],
  };
}

vi.mock("@/lib/supabase/client", () => ({
  supabase: createSupabaseMock({
    hymn_templates: {
      data: [
        template("tpl-1", "Amazing Grace"),
        template("tpl-2", "Blessed Assurance"),
      ],
      error: null,
    },
    // The church already copied tpl-2 in.
    songs: { data: [{ source_template_id: "tpl-2" }], error: null },
  }),
}));

function renderPage() {
  useAuthStore.setState({
    status: "authenticated",
    session: { user: { email: "a@church.org" } } as never,
    profile: {
      id: "u1",
      church_id: "church-1",
      email: "a@church.org",
      name: "Admin",
      role: "admin",
      onboarding_completed: true,
    } as Profile,
  });
  return render(
    <MemoryRouter initialEntries={["/songs/library"]}>
      <SongLibraryPage />
    </MemoryRouter>,
  );
}

/** The card for a given library song, located by its title. */
function cardFor(title: string) {
  return screen.getByText(title).closest("[data-testid='library-song']") as HTMLElement;
}

describe("SongLibraryPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("offers to add a library song the church doesn't have yet", async () => {
    renderPage();
    await screen.findByText("Amazing Grace");

    expect(
      within(cardFor("Amazing Grace")).getByRole("button", { name: /add to my hymnal/i }),
    ).toBeEnabled();
  });

  it("marks a song already copied in as Added and disables its button", async () => {
    renderPage();
    await screen.findByText("Blessed Assurance");

    const button = within(cardFor("Blessed Assurance")).getByRole("button");
    expect(button).toHaveTextContent(/added/i);
    expect(button).toBeDisabled();
  });
});
