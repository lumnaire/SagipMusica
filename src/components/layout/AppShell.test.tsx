import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, beforeEach } from "vitest";
import { useAuthStore } from "@/stores/auth-store";
import { AppShell } from "./AppShell";
import type { Profile } from "@/types/database";

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AppShell>
        <div>page content</div>
      </AppShell>
    </MemoryRouter>,
  );
}

function isActiveLink(name: string) {
  const link = screen.getByRole("link", { name });
  // Exact class-token match: the inactive branch's "hover:bg-sidebar-accent/60"
  // contains "bg-sidebar-accent" as a substring, so a naive .includes() check
  // would false-positive on it.
  return link.className.split(/\s+/).includes("bg-sidebar-accent");
}

describe("AppShell sidebar navigation", () => {
  beforeEach(() => {
    useAuthStore.setState({
      status: "authenticated",
      session: { user: { email: "test@church.org" } } as never,
      profile: { id: "u1", email: "test@church.org", name: "Test", role: "admin" } as Profile,
    });
  });

  it("highlights only Songs (not Categories) on the plain songs list", () => {
    renderAt("/songs");
    expect(isActiveLink("Songs")).toBe(true);
    expect(isActiveLink("Categories")).toBe(false);
  });

  it("highlights only Categories (not Songs) on the categories view", () => {
    renderAt("/songs?view=categories");
    expect(isActiveLink("Songs")).toBe(false);
    expect(isActiveLink("Categories")).toBe(true);
  });

  it("highlights Worship Sets on /sets", () => {
    renderAt("/sets");
    expect(isActiveLink("Worship Sets")).toBe(true);
  });

  it("only links to /sets once (no redundant 'Present' entry)", () => {
    renderAt("/sets");
    const setsLinks = screen.getAllByRole("link").filter((el) => el.getAttribute("href") === "/sets");
    // One per rendered sidebar (desktop); the mobile sidebar isn't mounted
    // until opened, so exactly one is expected here.
    expect(setsLinks).toHaveLength(1);
  });
});
