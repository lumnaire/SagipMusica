import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { createSupabaseMock } from "@/test/supabaseMock";
import { useAuthStore } from "@/stores/auth-store";
import { useEventStore } from "@/features/event/store";
import { DashboardPage } from "./DashboardPage";
import type { EventState } from "@/features/event/api";
import type { Profile } from "@/types/database";

/**
 * The first-run walkthrough, and the order everything after it arrives in.
 *
 * This exists because the walkthrough is invisible when it breaks. The effect
 * that starts it reads four conditions now, and any one of them quietly going
 * false looks exactly like "nothing happened" — while still marking the
 * account onboarded, so it never gets a second chance. Worse, a step whose
 * anchor has been renamed is a step that silently points at nothing.
 *
 * So the conditions and the anchors are pinned here rather than trusted.
 */

interface TourStep {
  element: string;
  popover: { title: string; description: string };
}

// vi.hoisted, because driver.js is now imported outright by DashboardPage
// rather than with await import(). vi.mock is lifted to the top of the file,
// so anything its factory closes over has to be lifted with it.
const mocks = vi.hoisted(() => {
  const drive = vi.fn();
  const driverFactory = vi.fn((_config: unknown) => ({ drive }));
  return { drive, driverFactory };
});

vi.mock("driver.js", () => ({ driver: mocks.driverFactory }));
vi.mock("driver.js/dist/driver.css", () => ({}));

const { drive, driverFactory } = mocks;
vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

// Spied so the "nothing to point at" case can prove the account is NOT burned.
const markOnboardingComplete = vi.fn(async (_id: string) => {});
vi.mock("@/features/dashboard/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/features/dashboard/api")>()),
  markOnboardingComplete: (id: string) => markOnboardingComplete(id),
}));

vi.mock("@/lib/supabase/client", () => ({
  supabase: createSupabaseMock({
    songs: { data: [], count: 0, error: null },
    worship_sets: { data: [], count: 0, error: null },
  }),
}));

function setProfile(patch: Partial<Profile>) {
  useAuthStore.setState({
    status: "authenticated",
    session: { user: { email: "new@church.org" } } as never,
    profile: {
      id: "u1",
      church_id: "church-1",
      email: "new@church.org",
      name: "New User",
      role: "admin",
      subscription: "free",
      subscription_granted_at: null,
      onboarding_completed: false,
      ...patch,
    } as Profile,
  });
}

/** The event answer the dashboard waits on before it starts the walkthrough. */
function setEvent(patch: Partial<EventState> = {}) {
  useEventStore.setState({
    status: "ready",
    offsetMs: 0,
    state: {
      active: true,
      visible: true,
      server_now: new Date().toISOString(),
      starts_at: "2026-09-14T00:00:00+08:00",
      ends_at: "2026-09-21T00:00:00+08:00",
      joined: false,
      participants: 3,
      announcement_seen: true,
      winner_slots: 5,
      ...patch,
    },
  });
}

/**
 * The store's real loader, so tests that need to hold the event answer open can
 * swap it out and put it back. DashboardPage calls load() on mount, and it
 * resolves against the mocked client fast enough to win any race a test tries
 * to set up by hand.
 */
const realLoad = useEventStore.getState().load;

function tourSteps(): TourStep[] {
  const config = driverFactory.mock.calls[0]?.[0] as { steps?: TourStep[] } | undefined;
  return config?.steps ?? [];
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/dashboard"]}>
      <DashboardPage />
    </MemoryRouter>,
  );
}

describe("first-run walkthrough", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useEventStore.setState({ load: realLoad });
    setEvent();
  });

  it("runs for an account that has not been onboarded", async () => {
    setProfile({ onboarding_completed: false });
    renderPage();

    await waitFor(() => expect(drive).toHaveBeenCalled());
  });

  it("points every step at an element that is actually on the page", async () => {
    setProfile({ onboarding_completed: false });
    renderPage();

    await waitFor(() => expect(driverFactory).toHaveBeenCalled());

    const steps = tourSteps();
    expect(steps.length).toBeGreaterThan(0);
    for (const step of steps) {
      expect(
        document.querySelector(step.element),
        `no element matches ${step.element}`,
      ).not.toBeNull();
    }
  });

  it("drops steps whose anchor is hidden, and keeps the ones that are not", async () => {
    // What a narrow window does to the sidebar: `hidden md:block` leaves the
    // nav in the DOM at `display: none`. Highlighting those gives popovers
    // nothing to attach to, and the walkthrough looks like it never ran --
    // five of seven steps pointing at a box with no size.
    //
    // The sidebar is hidden before the page mounts, so the steps are built
    // against it exactly as they would be on a phone.
    setProfile({ onboarding_completed: false });
    const { container } = render(
      <MemoryRouter initialEntries={["/dashboard"]}>
        <style>{"aside { display: none }"}</style>
        <DashboardPage />
      </MemoryRouter>,
    );
    void container;

    await waitFor(() => expect(driverFactory).toHaveBeenCalled());
    const steps = tourSteps().map((s) => s.element);

    // Nothing inside the hidden sidebar...
    expect(steps).not.toContain('[data-tour-id="nav-songs"]');
    expect(steps).not.toContain('[data-tour-id="nav-dashboard"]');
    // ...and the walkthrough still happens, out of what is left on the page.
    expect(steps).toContain('[data-tour-id="quick-actions"]');
    expect(drive).toHaveBeenCalled();
  });

  it("runs anyway when the visibility filter would leave nothing", async () => {
    // Every anchor hidden -- a window mid-resize, an odd stylesheet, a browser
    // that answers getComputedStyle differently. The filter is an improvement,
    // not a gate: a walkthrough that declines to run looks exactly like one
    // that is broken, and this is a first run that happens once.
    setProfile({ onboarding_completed: false });
    const { container } = renderPage();
    (container.firstElementChild as HTMLElement).style.display = "none";

    // Prove the page really is hidden, so this is testing the fallback rather
    // than passing because nothing was hidden in the first place.
    expect(window.getComputedStyle(container.firstElementChild as Element).display).toBe(
      "none",
    );

    await waitFor(() => expect(drive).toHaveBeenCalled());
    expect(tourSteps().length).toBeGreaterThan(0);
  });

  it("does not wait on the event, or mention it", async () => {
    // The walkthrough must never be blocked by a promotional feature, and no
    // longer says anything about it either -- the announcement bar does that.
    // Blocking on event_state() once took the whole first-run experience down
    // with it.
    useEventStore.setState({
      status: "loading",
      state: null,
      load: async () => new Promise(() => {}),
    });
    setProfile({ onboarding_completed: false });
    renderPage();

    await waitFor(() => expect(drive).toHaveBeenCalled());
    expect(tourSteps().map((s) => s.element)).not.toContain(
      '[data-tour-id="quick-action-event"]',
    );
  });

  it("does not run again once the account is onboarded", async () => {
    setProfile({ onboarding_completed: true });
    renderPage();

    await screen.findByText(/quick actions/i);
    expect(drive).not.toHaveBeenCalled();
  });
});

describe("the event's place on the dashboard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useEventStore.setState({ load: realLoad });
    setEvent();
  });

  it("is a quick action, not a board taking up the page", async () => {
    setProfile({ onboarding_completed: true });
    renderPage();

    expect(await screen.findByRole("button", { name: /limited event/i })).toBeInTheDocument();

    // The board's own copy belongs in the dialog, which is closed. If any of
    // this is on the page, the card has crept back into the flow.
    expect(screen.queryByText(/3-Text Hunt Challenge/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/players joined/i)).not.toBeInTheDocument();
  });

  it("shows how far along an account is without opening anything", async () => {
    setEvent({ joined: true, solved_levels: [1, 2] });
    setProfile({ onboarding_completed: true });
    renderPage();

    const button = await screen.findByRole("button", { name: /limited event/i });
    expect(button).toHaveTextContent("2/3");
  });

  it("disappears entirely once the event is over", async () => {
    setEvent({ visible: false });
    setProfile({ onboarding_completed: true });
    renderPage();

    await screen.findByText(/quick actions/i);
    expect(screen.queryByRole("button", { name: /limited event/i })).not.toBeInTheDocument();
  });
});
