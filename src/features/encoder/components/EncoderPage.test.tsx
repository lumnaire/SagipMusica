import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { createSupabaseMock } from "@/test/supabaseMock";
import { useAuthStore } from "@/stores/auth-store";
import { EncoderPage } from "./EncoderPage";
import type { Profile } from "@/types/database";

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

// vi.mock is hoisted above ordinary top-level consts, so the fixtures have to
// be hoisted with it.
const { ROWS } = vi.hoisted(() => {
  /** A complete template; pass overrides to knock holes in it. */
  function template(
    id: string,
    title: string,
    overrides: Record<string, unknown> = {},
    sectionCount = 3,
  ) {
    return {
      id,
      title,
      author: "John Newton",
      composer: "Traditional",
      category: "Hymn",
      key: "G",
      tempo: "Slow",
      description: null,
      status: "published",
      is_starter: false,
      copyright_status: "public_domain",
      order_index: 1,
      created_at: "2024-01-01T00:00:00Z",
      updated_at: "2024-01-02T00:00:00Z",
      updated_by: null,
      hymn_template_sections: [{ count: sectionCount }],
      ...overrides,
    };
  }

  return {
    ROWS: [
      // Missing ONLY an author.
      template("t1", "No Author Song", { author: null }),
      // Missing ONLY lyrics.
      template("t2", "No Lyrics Song", {}, 0),
      // Complete, and in its own category so the faceting test can isolate it.
      template("t3", "Complete Christmas Song", { category: "Christmas" }),
      // Padding so pagination has something to page.
      ...Array.from({ length: 17 }, (_, i) =>
        template(`p${i}`, `Padding Song ${i}`, { key: null }),
      ),
    ],
  };
});

vi.mock("@/lib/supabase/client", () => ({
  supabase: createSupabaseMock({
    hymn_templates: { data: ROWS, error: null },
  }),
}));

function renderPage() {
  useAuthStore.setState({
    status: "authenticated",
    session: { user: { email: "e@lumnaire.com" } } as never,
    profile: {
      id: "u1",
      church_id: null,
      email: "e@lumnaire.com",
      name: "Encoder",
      role: "encoder",
      onboarding_completed: false,
    } as Profile,
  });
  return render(
    <MemoryRouter initialEntries={["/encoder"]}>
      <EncoderPage />
    </MemoryRouter>,
  );
}

const chip = (name: RegExp) => screen.getByRole("button", { name });

describe("EncoderPage missing-content filters", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("combines chips as a union, not an intersection", async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText("No Author Song");

    await user.click(chip(/no author/i));
    expect(screen.getByText("No Author Song")).toBeInTheDocument();
    expect(screen.queryByText("No Lyrics Song")).not.toBeInTheDocument();

    // Adding the second chip must GROW the list. An intersection would show
    // neither, since no fixture row is missing both.
    await user.click(chip(/no lyrics/i));
    expect(screen.getByText("No Author Song")).toBeInTheDocument();
    expect(screen.getByText("No Lyrics Song")).toBeInTheDocument();
  });

  it("counts each gap across the whole library", async () => {
    renderPage();
    await screen.findByText("No Author Song");

    expect(chip(/no author/i)).toHaveTextContent("1");
    expect(chip(/no lyrics/i)).toHaveTextContent("1");
    expect(chip(/no key/i)).toHaveTextContent("17");
    // Every fixture row has one, so this queue is genuinely empty.
    expect(chip(/no composer/i)).toHaveTextContent("0");
  });

  // Faceting is driven through the search box rather than the category select:
  // both narrow the same `base` memo the counts are computed from, and Radix's
  // Select needs pointer-capture APIs jsdom doesn't implement.
  it("facets the counts against the other filters", async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText("No Author Song");

    expect(chip(/no key/i)).toHaveTextContent("17");

    await user.type(screen.getByPlaceholderText(/search by title/i), "Christmas");

    // Only the one complete song remains in scope, so every gap count must
    // collapse to zero rather than keep reporting library-wide totals.
    expect(screen.getByText("Complete Christmas Song")).toBeInTheDocument();
    expect(chip(/no key/i)).toHaveTextContent("0");
    expect(chip(/no author/i)).toHaveTextContent("0");
  });

  it("clears every chip at once", async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText("No Author Song");

    await user.click(chip(/no author/i));
    expect(chip(/no author/i)).toHaveAttribute("aria-pressed", "true");

    await user.click(screen.getByRole("button", { name: /^clear$/i }));
    expect(chip(/no author/i)).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByText("No Lyrics Song")).toBeInTheDocument();
  });
});

describe("EncoderPage pagination", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("pages a long library and returns to page one when a chip changes", async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText("No Author Song");

    // 20 rows, 15 per page.
    expect(screen.getByText(/showing 1–15 of 20 songs/i)).toBeInTheDocument();
    expect(screen.getByText(/page 1 of 2/i)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /next/i }));
    expect(screen.getByText(/showing 16–20 of 20 songs/i)).toBeInTheDocument();

    // Filtering while on page 2 must not strand the reader on a page that no
    // longer exists.
    await user.click(chip(/no key/i));
    expect(screen.getByText(/showing 1–15 of 17 songs/i)).toBeInTheDocument();
  });
});
