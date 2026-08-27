import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SupportCard } from "./SupportCard";
import { CreditsCard, CreditsRow } from "./CreditsCard";
import { BUY_ME_A_COFFEE_URL, DEVELOPER } from "@/lib/links";

/**
 * These two cards are the same file on the web and the desktop — the desktop
 * renderer imports them through the `@` alias. So a break here breaks both,
 * and the things worth pinning are the ones that would be embarrassing to get
 * wrong in front of someone about to give money: the name, and the link.
 */

describe("SupportCard", () => {
  it("shows the QR code and the donate link", () => {
    render(<SupportCard />);

    const link = screen.getByRole("link", { name: /buy us a coffee/i });
    expect(link).toHaveAttribute("href", BUY_ME_A_COFFEE_URL);
    // Opens outside the app: a new tab on the web, the user's browser on the
    // desktop (see setWindowOpenHandler in main/windows.ts).
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noreferrer");

    expect(screen.getByAltText(/buy me a coffee qr code/i)).toBeInTheDocument();
  });

  it("spells the address out as text as well, for someone reading it off a screen", () => {
    render(<SupportCard />);
    expect(screen.getByText("buymeacoffee.com/lumnaire")).toBeInTheDocument();
  });

  it("says what it accepts, so nobody has to guess whether their method works", () => {
    render(<SupportCard />);
    expect(screen.getByText(/gcash/i)).toBeInTheDocument();
    expect(screen.getByText(/us\s*dollars/i)).toBeInTheDocument();
  });
});

describe("CreditsCard", () => {
  it("credits the developer by name and title", () => {
    render(<CreditsCard />);

    expect(screen.getByText(DEVELOPER.name)).toBeInTheDocument();
    expect(screen.getByText(DEVELOPER.title)).toBeInTheDocument();
    expect(screen.getByText("Ronald Castromero")).toBeInTheDocument();
    expect(screen.getByText("Founder of Lumnaire")).toBeInTheDocument();
  });

  it("links out to Lumnaire", () => {
    render(<CreditsCard />);
    expect(screen.getByRole("link", { name: /lumnaire/i })).toHaveAttribute(
      "href",
      expect.stringContaining("facebook.com/lumnaireph"),
    );
  });

  it("renders the build-specific facts the desktop passes in", () => {
    // The desktop puts its version and database path here; the web passes
    // nothing and the list is omitted entirely.
    const { rerender } = render(<CreditsCard />);
    expect(screen.queryByText("Version")).not.toBeInTheDocument();

    rerender(
      <CreditsCard>
        <CreditsRow label="Version">1.2.1</CreditsRow>
      </CreditsCard>,
    );
    expect(screen.getByText("Version")).toBeInTheDocument();
    expect(screen.getByText("1.2.1")).toBeInTheDocument();
  });
});
