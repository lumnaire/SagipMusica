import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { WorldMap, type WorldMapPin } from "./WorldMap";

function pin(overrides: Partial<WorldMapPin> & { slug: string }): WorldMapPin {
  return {
    name: "Cebu",
    country_name: "Philippines",
    lat: 10.32,
    lng: 123.9,
    churches: 1,
    downloads: 0,
    ...overrides,
  };
}

const CEBU = pin({ slug: "ph-cebu", churches: 12, downloads: 8 });
const THAILAND = pin({
  slug: "country-th",
  name: "Thailand",
  country_name: "Thailand",
  lat: 15.13,
  lng: 101.0,
  churches: 1,
  downloads: 0,
});

describe("WorldMap", () => {
  it("draws a button per pin, labelled for a screen reader", () => {
    render(<WorldMap pins={[CEBU, THAILAND]} />);

    expect(
      screen.getByRole("button", {
        name: "Cebu, Philippines: 12 churches, 8 desktop installs",
      }),
    ).toBeInTheDocument();
    // A country pin does not repeat its own name as its country.
    expect(
      screen.getByRole("button", { name: "Thailand: 1 church, 0 desktop installs" }),
    ).toBeInTheDocument();
  });

  it("shows the place and its counts on hover", async () => {
    const user = userEvent.setup();
    render(<WorldMap pins={[CEBU]} />);

    expect(screen.queryByRole("status")).not.toBeInTheDocument();

    await user.hover(screen.getByRole("button", { name: /^Cebu/ }));

    const tooltip = screen.getByRole("status");
    expect(tooltip).toHaveTextContent("Cebu");
    expect(tooltip).toHaveTextContent("Philippines");
    expect(tooltip).toHaveTextContent("12 churches");
    expect(tooltip).toHaveTextContent("8 desktop installs");
  });

  it("says so when a pin was placed by hand rather than counted", async () => {
    const user = userEvent.setup();
    render(<WorldMap pins={[pin({ slug: "manual-1", name: "Sagada", churches: 0 })]} />);

    await user.hover(screen.getByRole("button", { name: /^Sagada/ }));
    expect(screen.getByRole("status")).toHaveTextContent("Placed by hand");
  });

  it("reports the pin that was clicked", async () => {
    const user = userEvent.setup();
    const onSelectPin = vi.fn();
    render(<WorldMap pins={[CEBU]} onSelectPin={onSelectPin} />);

    await user.click(screen.getByRole("button", { name: /^Cebu/ }));
    expect(onSelectPin).toHaveBeenCalledWith(expect.objectContaining({ slug: "ph-cebu" }));
  });

  it("offers zoom and reset without a mouse", () => {
    render(<WorldMap pins={[CEBU]} />);
    expect(screen.getByRole("button", { name: "Zoom in" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Zoom out" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Reset the view" })).toBeInTheDocument();
  });

  it("renders extra toolbar controls its caller passes in", () => {
    render(
      <WorldMap
        pins={[CEBU]}
        toolbar={<button type="button">Place a pin</button>}
      />,
    );
    expect(screen.getByRole("button", { name: "Place a pin" })).toBeInTheDocument();
  });

  /**
   * The pins are HTML positioned over the SVG rather than drawn inside it, so
   * "is this pin in the right place" is a question about a percentage. Cebu is
   * east and south of Bangkok, and must come out right and below it.
   */
  it("positions pins by their coordinates", () => {
    render(<WorldMap pins={[CEBU, THAILAND]} />);

    const cebu = screen.getByRole("button", { name: /^Cebu/ });
    const thailand = screen.getByRole("button", { name: /^Thailand/ });

    const left = (el: HTMLElement) => Number.parseFloat(el.style.left);
    const top = (el: HTMLElement) => Number.parseFloat(el.style.top);

    expect(left(cebu)).toBeGreaterThan(left(thailand));
    expect(top(cebu)).toBeGreaterThan(top(thailand));
  });

  /**
   * A pin hidden from the public map still has to be findable on the
   * operator's, and has to be obviously *off*. Dimming the same filled dot
   * reads as "smaller", not "hidden", so it becomes a dashed outline with the
   * glow removed -- the glow being the thing that makes a pin look live.
   */
  it("draws a hidden pin as a dashed outline with no glow", () => {
    const { container } = render(
      <WorldMap pins={[{ ...CEBU, muted: true }]} tone="day" />,
    );

    const core = container.querySelector<HTMLElement>("[data-map-pin] span:last-child")!;
    expect(core.style.border).toContain("dashed");
    expect(core.style.boxShadow).toBe("");
    // The blurred halo and the ping are the two glow layers; neither is drawn.
    expect(container.querySelectorAll("[data-map-pin] span")).toHaveLength(1);
  });

  it("keeps the glow on a pin that is on the public map", () => {
    const { container } = render(<WorldMap pins={[CEBU]} tone="day" />);
    const spans = container.querySelectorAll("[data-map-pin] span");
    expect(spans.length).toBeGreaterThan(1);
  });

  /**
   * The map sits mid-page on a landing page people scroll past, and it must
   * never eat the gesture they are scrolling with. Both of these were real
   * bugs: a wheel notch over the map used to scroll the page AND zoom the map
   * from the same notch, and `touch-action: none` left phone users unable to
   * swipe past the map at all.
   */
  describe("gestures", () => {
    const surface = () => document.querySelector<HTMLElement>('[role="application"]')!;
    const viewBox = () => document.querySelector("svg")!.getAttribute("viewBox");

    // The listener is a native one (React's own wheel binding is passive and
    // could not preventDefault), so the state update it causes is outside
    // React's event system and has to be flushed by hand.
    function wheel(el: HTMLElement, init: WheelEventInit) {
      const event = new WheelEvent("wheel", { bubbles: true, cancelable: true, ...init });
      act(() => {
        el.dispatchEvent(event);
      });
      return event;
    }

    it("lets the page keep a plain scroll, and says why", async () => {
      render(<WorldMap pins={[CEBU]} />);
      const before = viewBox();

      const event = wheel(surface(), { deltaY: 120 });

      expect(event.defaultPrevented).toBe(false);
      expect(viewBox()).toBe(before);
      expect(await screen.findByText("Hold Ctrl and scroll to zoom")).toBeInTheDocument();
    });

    it("zooms on Ctrl+wheel, and keeps that notch from the page", () => {
      render(<WorldMap pins={[CEBU]} />);
      const before = viewBox();

      const event = wheel(surface(), { deltaY: -120, ctrlKey: true });

      expect(event.defaultPrevented).toBe(true);
      expect(viewBox()).not.toBe(before);
    });

    it("leaves vertical scrolling to the browser on a cooperative map", () => {
      render(<WorldMap pins={[CEBU]} />);
      expect(surface().style.touchAction).toBe("pan-y pinch-zoom");
    });

    it("takes the whole gesture when it is the point of the screen", () => {
      render(<WorldMap pins={[CEBU]} gesture="direct" />);
      expect(surface().style.touchAction).toBe("none");

      const before = viewBox();
      const event = wheel(surface(), { deltaY: -120 });
      expect(event.defaultPrevented).toBe(true);
      expect(viewBox()).not.toBe(before);
    });
  });

  it("sizes a busy place above a quiet one", () => {
    render(<WorldMap pins={[CEBU, THAILAND]} />);
    const width = (name: RegExp) =>
      Number.parseFloat(screen.getByRole("button", { name }).style.width);
    expect(width(/^Cebu/)).toBeGreaterThan(width(/^Thailand/));
  });
});
