import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { UpcomingUpdates } from "./UpcomingUpdates";
import type { PlatformUpdate } from "@/types/database";

const fetchPublishedUpdates = vi.fn();

vi.mock("@/features/updates/api", () => ({
  fetchPublishedUpdates: () => fetchPublishedUpdates(),
}));

function update(id: string, title: string, detail: string | null): PlatformUpdate {
  return {
    id,
    title,
    detail,
    is_published: true,
    created_by: null,
    created_at: "2026-08-01T00:00:00Z",
    updated_at: "2026-08-01T00:00:00Z",
  };
}

describe("UpcomingUpdates", () => {
  beforeEach(() => {
    fetchPublishedUpdates.mockReset();
  });

  it("lists what is on the board", async () => {
    fetchPublishedUpdates.mockResolvedValue([
      update(
        "u-1",
        "Built-in Bible for verse presentation",
        "Look up a passage and send it to the screen.",
      ),
      update("u-2", "macOS build", null),
    ]);

    render(<UpcomingUpdates />);

    expect(
      await screen.findByText("Built-in Bible for verse presentation"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Look up a passage and send it to the screen."),
    ).toBeInTheDocument();
    // An entry with no detail still renders, on its title alone.
    expect(screen.getByText("macOS build")).toBeInTheDocument();
  });

  it("asks for suggestions when the board is empty", async () => {
    fetchPublishedUpdates.mockResolvedValue([]);

    render(<UpcomingUpdates />);

    expect(
      await screen.findByText("Nothing on the board at the moment"),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /send us a suggestion/i }),
    ).toBeInTheDocument();
  });

  it("does not claim the board is empty when the fetch failed", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    fetchPublishedUpdates.mockRejectedValue(new Error("offline"));

    render(<UpcomingUpdates />);

    // The distinction matters: "nothing planned" is a claim about the roadmap,
    // and an unreachable database is no evidence for it.
    expect(
      await screen.findByText("The board couldn't be loaded just now"),
    ).toBeInTheDocument();
    expect(
      screen.queryByText("Nothing on the board at the moment"),
    ).not.toBeInTheDocument();
  });
});
