import { render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { createSupabaseMock } from "@/test/supabaseMock";
import { ReleasesPage } from "./ReleasesPage";
import { ReleaseAnnouncement } from "./ReleaseAnnouncement";
import {
  LATEST_RELEASE,
  PREVIOUS_RELEASES,
  RELEASES,
  installerUrl,
  releaseNotesUrl,
} from "../releases";

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("@/lib/supabase/client", () => ({ supabase: createSupabaseMock() }));

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/releases"]}>
      <ReleasesPage />
    </MemoryRouter>,
  );
}

describe("release data", () => {
  it("is ordered newest first, which everything else derives from", () => {
    // LATEST_RELEASE is RELEASES[0] rather than a flag on a row, so the order
    // is the only thing that can make it wrong.
    const dates = RELEASES.map((r) => r.date);
    expect([...dates].sort().reverse()).toEqual(dates);
    expect(LATEST_RELEASE).toBe(RELEASES[0]);
  });

  it("has no duplicate versions or tags", () => {
    expect(new Set(RELEASES.map((r) => r.version)).size).toBe(RELEASES.length);
    expect(new Set(RELEASES.map((r) => r.tag)).size).toBe(RELEASES.length);
  });

  it("sends the newest build through GitHub's latest redirect and older ones to their tag", () => {
    // The redirect keeps working if a release is re-cut; a tag URL is the only
    // way to reach a build that is deliberately not the latest.
    expect(installerUrl(LATEST_RELEASE)).toContain("/releases/latest/download/");

    for (const release of PREVIOUS_RELEASES) {
      expect(installerUrl(release)).toContain(`/releases/download/${release.tag}/`);
      expect(installerUrl(release).endsWith("SagipMusica-Setup.exe")).toBe(true);
    }
  });
});

describe("ReleasesPage", () => {
  it("leads with the current version and recommends it", () => {
    renderPage();

    expect(
      screen.getByRole("heading", { name: `Version ${LATEST_RELEASE.version}` }),
    ).toBeInTheDocument();
    expect(screen.getAllByText(/recommended/i).length).toBeGreaterThan(0);
    expect(screen.getByText(LATEST_RELEASE.summary)).toBeInTheDocument();
  });

  it("lists every release in the table, newest first", () => {
    renderPage();

    const rows = screen.getAllByRole("row").slice(1); // drop the header
    expect(rows).toHaveLength(RELEASES.length);

    RELEASES.forEach((release, i) => {
      expect(within(rows[i]).getByText(release.version)).toBeInTheDocument();
      expect(within(rows[i]).getByText(release.size)).toBeInTheDocument();
    });
  });

  it("keeps older versions downloadable", () => {
    // The point of the page: a church that hits a bug in the newest build can
    // get back to the one that worked.
    renderPage();

    for (const release of PREVIOUS_RELEASES) {
      const links = screen.getAllByRole("link", { name: /download/i });
      expect(links.some((a) => a.getAttribute("href") === installerUrl(release))).toBe(true);
    }
  });

  it("only marks the newest one recommended", () => {
    renderPage();

    const rows = screen.getAllByRole("row").slice(1);
    expect(within(rows[0]).getByText(/recommended/i)).toBeInTheDocument();

    for (const row of rows.slice(1)) {
      expect(within(row).queryByText(/recommended/i)).not.toBeInTheDocument();
    }
  });

  it("links each row to its notes on GitHub", () => {
    renderPage();

    for (const release of RELEASES) {
      const links = screen.getAllByRole("link", { name: /release notes|full notes/i });
      expect(links.some((a) => a.getAttribute("href") === releaseNotesUrl(release))).toBe(true);
    }
  });
});

describe("ReleaseAnnouncement", () => {
  it("names the current version and goes to the releases page", () => {
    render(
      <MemoryRouter>
        <ReleaseAnnouncement />
      </MemoryRouter>,
    );

    const link = screen.getByRole("link");
    expect(link).toHaveAttribute("href", "/releases");
    expect(link).toHaveTextContent(`Version ${LATEST_RELEASE.version} is out`);
  });
});
