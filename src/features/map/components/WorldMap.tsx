import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { Minus, Plus, Maximize2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { WORLD_SHAPES } from "../world-geometry";
import {
  clampView,
  fitPoints,
  project,
  unproject,
  viewBoxAttr,
  zoomView,
  WORLD_VIEW,
  type Point,
  type View,
} from "../projection";

export interface WorldMapPin {
  slug: string;
  name: string;
  country_name: string;
  lat: number;
  lng: number;
  churches: number;
  downloads: number;
  /** Drawn hollow and dimmed. Only the operator's map passes this. */
  muted?: boolean;
}

interface WorldMapProps {
  pins: WorldMapPin[];
  /** "night" closes the landing page; "day" sits in the superadmin dashboard. */
  tone?: "night" | "day";
  className?: string;
  selectedSlug?: string | null;
  onSelectPin?: (pin: WorldMapPin | null) => void;
  /**
   * Turns the map into a coordinate picker: clicking anywhere reports where,
   * instead of clearing the selection. Used to place a pin by hand.
   */
  onPickCoordinates?: (lat: number, lng: number) => void;
  /** Extra controls rendered into the toolbar, e.g. a "place a pin" toggle. */
  toolbar?: React.ReactNode;
  /**
   * Who owns a scroll or a swipe that starts on the map.
   *
   * "cooperative" -- the PAGE does. A full-width map sitting in the middle of
   * a scrolling landing page must never eat the gesture somebody is using to
   * read past it: on a phone that traps them on the map with no way down, and
   * on a desktop it means the map lurches through three zoom levels while the
   * page scrolls underneath. Zooming is then deliberate: Ctrl (or a trackpad
   * pinch, which arrives as a Ctrl-wheel) and the on-screen buttons.
   *
   * "direct" -- the MAP does, because it is the point of the screen rather
   * than something you scroll past. The superadmin panel uses this.
   */
  gesture?: "cooperative" | "direct";
}

/**
 * How hot a pin runs, from the number of congregations behind it.
 *
 * Deliberately an ABSOLUTE scale, not a share of the busiest pin. A relative
 * ramp would repaint the whole map every time one province pulled ahead, and a
 * lone church in Batanes would slide from red to gold without anything about
 * that church having changed. On this curve one church is always gold, four is
 * amber, and twenty is the red the map is building towards.
 */
function intensity(total: number): number {
  return 1 - 1 / (1 + total / 4);
}

/**
 * Gold to ember, in OKLCH so the ramp stays evenly bright.
 *
 * Interpolating these three channels in sRGB would sag through a muddy brown
 * in the middle; in OKLCH the midpoint is the orange you would have picked by
 * hand. The gold end is the site's own --accent, so a single pin belongs to the
 * brand and only a real cluster earns the red.
 */
function heat(t: number, alpha = 1): string {
  const l = 0.82 - 0.2 * t;
  const c = 0.12 + 0.11 * t;
  const h = 88 - 66 * t;
  return `oklch(${l.toFixed(3)} ${c.toFixed(3)} ${h.toFixed(1)}${alpha < 1 ? ` / ${alpha}` : ""})`;
}

/** Pin radius in CSS pixels: area with the count, so ten is not ten times wide. */
function radiusFor(total: number): number {
  return Math.min(22, 4.5 + 3.4 * Math.sqrt(total));
}

const ZOOM_STEP = 1.6;

/**
 * The pin map, drawn from a generated SVG outline rather than a tile service.
 *
 * Two layers, on purpose:
 *
 *  * The coastline is an <svg>, panned and zoomed by moving its viewBox. One
 *    element, 240 paths, no per-frame work.
 *
 *  * The pins are HTML on top of it, positioned in percentages recomputed from
 *    that same viewBox. Inside the SVG they would scale with the zoom -- a pin
 *    the size of Luzon at maximum zoom -- and every one of them would need
 *    counter-scaling by hand. As DOM they get constant pixel sizes, real
 *    focus rings, real buttons, and a CSS pulse for free.
 *
 * There is no tile layer and no map library. vercel.json restricts img-src to
 * 'self', so a basemap would mean widening the CSP across the whole site for a
 * background the pins do not need: these points are province centroids, and a
 * street-level basemap under a province-level pin promises a precision that
 * does not exist.
 */
export function WorldMap({
  pins,
  tone = "night",
  className,
  selectedSlug = null,
  onSelectPin,
  onPickCoordinates,
  toolbar,
  gesture = "cooperative",
}: WorldMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [view, setView] = useState<View>(WORLD_VIEW);
  const [hovered, setHovered] = useState<string | null>(null);
  const [hint, setHint] = useState(false);
  const gradientId = useId();

  /** Whether the map may take a gesture the page might have wanted. */
  const ownsGestures = gesture === "direct";

  const aspect = size.width > 0 && size.height > 0 ? size.width / size.height : 16 / 9;

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => {
      if (entry) setSize({ width: entry.contentRect.width, height: entry.contentRect.height });
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const projected = useMemo(
    () => pins.map((pin) => ({ pin, point: project(pin.lat, pin.lng) })),
    [pins],
  );

  // Open on wherever the churches actually are. A world map centred on the
  // Atlantic is the correct projection and the wrong first impression when
  // every pin is in South East Asia.
  const framed = useRef(false);
  useEffect(() => {
    if (framed.current || size.width === 0) return;
    if (projected.length === 0) return;
    framed.current = true;
    setView(
      fitPoints(
        projected.map((p) => p.point),
        aspect,
      ),
    );
  }, [projected, aspect, size.width]);

  // A resize changes the aspect ratio, so the view has to be re-shaped or the
  // map stretches.
  useEffect(() => {
    if (size.width === 0) return;
    setView((current) => clampView(current, aspect));
  }, [aspect, size.width]);

  const resetView = useCallback(() => {
    setView(
      projected.length > 0
        ? fitPoints(
            projected.map((p) => p.point),
            aspect,
          )
        : clampView(WORLD_VIEW, aspect),
    );
  }, [projected, aspect]);

  const zoomBy = useCallback(
    (factor: number, anchorU = 0.5, anchorV = 0.5) => {
      setView((current) => zoomView(current, factor, anchorU, anchorV, aspect));
    },
    [aspect],
  );

  // Wheel is bound by hand rather than through onWheel because React attaches
  // wheel listeners passively at the root, and a passive listener cannot call
  // preventDefault. Without preventDefault the page scrolls AND the map zooms
  // from the same notch, which is the lurch this whole arrangement exists to
  // stop.
  const hintTimer = useRef<number | undefined>(undefined);
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    function onWheel(event: WheelEvent) {
      // A trackpad pinch arrives as a wheel event with ctrlKey set, so this
      // one test covers both "hold Ctrl and scroll" and "pinch the trackpad".
      const wantsZoom = ownsGestures || event.ctrlKey || event.metaKey;
      if (!wantsZoom) {
        // Say why nothing happened, then get out of the way.
        setHint(true);
        window.clearTimeout(hintTimer.current);
        hintTimer.current = window.setTimeout(() => setHint(false), 1600);
        return;
      }
      event.preventDefault();
      const rect = el!.getBoundingClientRect();
      zoomBy(
        Math.exp(-event.deltaY * 0.0016),
        (event.clientX - rect.left) / rect.width,
        (event.clientY - rect.top) / rect.height,
      );
    }

    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [ownsGestures, zoomBy]);

  useEffect(() => () => window.clearTimeout(hintTimer.current), []);

  // --- Pan and pinch --------------------------------------------------------
  //
  // Pointer events rather than mouse+touch pairs, so a stylus works and a
  // second finger can join a drag already in progress. `pointers` holds every
  // contact currently down; one is a pan, two is a pinch.

  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const pinchDistance = useRef<number | null>(null);
  const dragged = useRef(false);

  /**
   * A finger on a cooperative map belongs to the page, not to us.
   *
   * touch-action below already hands the browser the vertical scroll, but the
   * pointer events still arrive until it decides the gesture is a scroll --
   * and acting on those first few is what makes the map jitter under a swipe
   * before snapping back. A mouse drag is never a page scroll, so it pans in
   * either mode.
   */
  function pointerMayPan(event: ReactPointerEvent<HTMLDivElement>) {
    return ownsGestures || event.pointerType !== "touch";
  }

  function handlePointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    // Let the pin buttons handle their own clicks.
    if ((event.target as HTMLElement).closest("[data-map-pin]")) return;
    if (!pointerMayPan(event)) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    dragged.current = false;
  }

  function handlePointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    const previous = pointers.current.get(event.pointerId);
    if (!previous) return;
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });

    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const contacts = [...pointers.current.values()];

    if (contacts.length >= 2) {
      const distance = Math.hypot(
        contacts[0].x - contacts[1].x,
        contacts[0].y - contacts[1].y,
      );
      if (pinchDistance.current !== null && pinchDistance.current > 0) {
        const midX = (contacts[0].x + contacts[1].x) / 2;
        const midY = (contacts[0].y + contacts[1].y) / 2;
        zoomBy(
          distance / pinchDistance.current,
          (midX - rect.left) / rect.width,
          (midY - rect.top) / rect.height,
        );
      }
      pinchDistance.current = distance;
      dragged.current = true;
      return;
    }

    const dx = event.clientX - previous.x;
    const dy = event.clientY - previous.y;
    if (Math.abs(dx) > 1 || Math.abs(dy) > 1) dragged.current = true;
    setView((current) =>
      clampView(
        {
          ...current,
          x: current.x - (dx / rect.width) * current.width,
          y: current.y - (dy / rect.height) * current.height,
        },
        aspect,
      ),
    );
  }

  function handlePointerUp(event: ReactPointerEvent<HTMLDivElement>) {
    pointers.current.delete(event.pointerId);
    if (pointers.current.size < 2) pinchDistance.current = null;

    // Same gate as pointerdown, and for a sharper reason: without it a touch
    // we deliberately ignored still arrives here, reads a stale `dragged` from
    // whatever happened last, and drops a pin or clears the selection on what
    // the visitor experienced as scrolling the page.
    if (!pointerMayPan(event)) return;

    // A drag that ends over the map is not a click on it. Without this, every
    // pan finishes by either clearing the selection or dropping a pin.
    if (dragged.current) return;
    if ((event.target as HTMLElement).closest("[data-map-pin]")) return;

    const el = containerRef.current;
    if (!el) return;
    if (onPickCoordinates) {
      const rect = el.getBoundingClientRect();
      const { lat, lng } = unproject(
        view.x + ((event.clientX - rect.left) / rect.width) * view.width,
        view.y + ((event.clientY - rect.top) / rect.height) * view.height,
      );
      onPickCoordinates(lat, lng);
      return;
    }
    onSelectPin?.(null);
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    const nudge = 0.12;
    const moves: Record<string, [number, number]> = {
      ArrowLeft: [-nudge, 0],
      ArrowRight: [nudge, 0],
      ArrowUp: [0, -nudge],
      ArrowDown: [0, nudge],
    };
    const move = moves[event.key];
    if (move) {
      event.preventDefault();
      setView((current) =>
        clampView(
          {
            ...current,
            x: current.x + move[0] * current.width,
            y: current.y + move[1] * current.height,
          },
          aspect,
        ),
      );
      return;
    }
    if (event.key === "+" || event.key === "=") {
      event.preventDefault();
      zoomBy(ZOOM_STEP);
    } else if (event.key === "-" || event.key === "_") {
      event.preventDefault();
      zoomBy(1 / ZOOM_STEP);
    }
  }

  // --- Drawing --------------------------------------------------------------

  const night = tone === "night";
  const active = hovered ?? selectedSlug;

  // Only what is on screen, with a margin so a pin does not pop in at the edge
  // mid-pan. At world zoom this is every pin; the check earns its keep when
  // somebody zooms into one province and the other 200 fall away.
  const visible = useMemo(() => {
    const margin = 0.08;
    return projected
      .map(({ pin, point }) => ({
        pin,
        u: (point.x - view.x) / view.width,
        v: (point.y - view.y) / view.height,
      }))
      .filter(({ u, v }) => u > -margin && u < 1 + margin && v > -margin && v < 1 + margin)
      // Biggest first in the DOM so the smallest pins paint on top and stay
      // clickable inside a big pin's halo.
      .sort((a, b) => b.pin.churches + b.pin.downloads - (a.pin.churches + a.pin.downloads));
  }, [projected, view]);

  const activePin = visible.find(({ pin }) => pin.slug === active);

  return (
    <div
      className={cn(
        "relative select-none overflow-hidden",
        night ? "bg-[#0b1220]" : "bg-slate-100",
        className,
      )}
    >
      <div
        ref={containerRef}
        role="application"
        tabIndex={0}
        aria-label="Map of places using SagipMusica. Drag to pan, scroll to zoom, arrow keys to move."
        className={cn(
          "h-full w-full outline-none focus-visible:ring-2 focus-visible:ring-inset",
          night ? "focus-visible:ring-white/40" : "focus-visible:ring-primary/50",
          onPickCoordinates ? "cursor-crosshair" : "cursor-grab active:cursor-grabbing",
        )}
        // pinch-zoom is kept even on the cooperative map: taking away a
        // visitor's ability to magnify part of a page is an accessibility
        // problem, not a gesture conflict.
        style={{ touchAction: ownsGestures ? "none" : "pan-y pinch-zoom" }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onKeyDown={handleKeyDown}
      >
        <svg
          viewBox={viewBoxAttr(view)}
          preserveAspectRatio="xMidYMid slice"
          className="h-full w-full"
          aria-hidden="true"
        >
          <defs>
            {/* A cool wash across the oceans so the plate does not read as a
                flat rectangle behind the land. */}
            <linearGradient id={`${gradientId}-sea`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={night ? "#0e1729" : "#e7edf5"} />
              <stop offset="100%" stopColor={night ? "#080e1a" : "#f4f7fb"} />
            </linearGradient>
          </defs>

          <rect
            x={WORLD_VIEW.x}
            y={WORLD_VIEW.y}
            width={WORLD_VIEW.width}
            height={WORLD_VIEW.height}
            fill={`url(#${gradientId}-sea)`}
          />

          <g
            fill={night ? "#1c2941" : "#cfd9e8"}
            stroke={night ? "#31435f" : "#aebbd0"}
            // Without this the coastlines thicken into a solid mass as you
            // zoom, because stroke-width is in user units.
            vectorEffect="non-scaling-stroke"
            strokeWidth={0.75}
            strokeLinejoin="round"
          >
            {/* `key`, not `id`. A country code is shared by a country and its
                outlying territories -- Australia and Ashmore and Cartier
                Islands are both "AU" -- and five disputed territories have no
                ISO code at all. Keyed on `id`, React reconciles those shapes
                into each other's elements. */}
            {WORLD_SHAPES.map((shape) => (
              <path key={shape.key} d={shape.d} />
            ))}
          </g>
        </svg>

        {/* Pins. Positioned in percentages of the container, so they keep a
            constant size however far the map is zoomed. */}
        <div className="pointer-events-none absolute inset-0">
          {visible.map(({ pin, u, v }) => {
            // A hand-placed pin has nothing counted behind it, and drawn at
            // its true weight it is a four-pixel smudge in the palest gold on
            // the ramp -- invisible, which defeats the point of placing it.
            // Treated as one congregation, which is what it stands for.
            const total = Math.max(1, pin.churches + pin.downloads);
            const t = intensity(total);
            const r = radiusFor(total);
            const isActive = pin.slug === active;
            return (
              <button
                key={pin.slug}
                type="button"
                data-map-pin
                className="pointer-events-auto absolute -translate-x-1/2 -translate-y-1/2 rounded-full outline-none focus-visible:ring-2 focus-visible:ring-white/80"
                style={{ left: `${u * 100}%`, top: `${v * 100}%`, width: r * 2, height: r * 2 }}
                onPointerEnter={() => setHovered(pin.slug)}
                onPointerLeave={() => setHovered((s) => (s === pin.slug ? null : s))}
                onFocus={() => setHovered(pin.slug)}
                onBlur={() => setHovered((s) => (s === pin.slug ? null : s))}
                onClick={() => onSelectPin?.(pin)}
                aria-label={`${pin.name}${
                  pin.name === pin.country_name ? "" : `, ${pin.country_name}`
                }: ${pin.churches} ${pin.churches === 1 ? "church" : "churches"}, ${
                  pin.downloads
                } desktop ${pin.downloads === 1 ? "install" : "installs"}`}
              >
                {/* Halo, core, and -- for the busiest places only -- a ring
                    that breathes. Pulsing all of them at once turns the map
                    into a disco; pulsing the hubs makes it look alive.
                    A muted pin gets neither: the glow is what makes a pin look
                    live, and a hidden one is precisely not. It is left as a
                    dashed outline, which is legible as "this exists but is
                    switched off" in a way a dimmer version of the same dot is
                    not. */}
                {!pin.muted && (
                  <>
                    <span
                      className="absolute inset-0 rounded-full blur-[3px]"
                      style={{ background: heat(t, 0.32) }}
                    />
                    {t > 0.45 && (
                      <span
                        className="absolute inset-0 rounded-full motion-safe:animate-ping"
                        style={{ background: heat(t, 0.28), animationDuration: "2.8s" }}
                      />
                    )}
                  </>
                )}
                <span
                  className={cn(
                    "absolute rounded-full transition-transform duration-150",
                    isActive && "scale-125",
                  )}
                  style={
                    pin.muted
                      ? {
                          inset: r * 0.2,
                          background: night ? "rgba(0,0,0,0.35)" : "rgba(255,255,255,0.65)",
                          border: `2.5px dashed ${heat(t)}`,
                        }
                      : {
                          inset: r * 0.42,
                          background: heat(t),
                          border: `1.5px solid ${
                            night ? "rgba(255,255,255,0.85)" : "rgba(255,255,255,0.95)"
                          }`,
                          boxShadow: `0 0 ${r}px ${heat(t, 0.55)}`,
                        }
                  }
                />
              </button>
            );
          })}
        </div>

        {/* Tooltip. Flipped to the other side of the pin near the edges so it
            is never clipped by the frame. */}
        {activePin && (
          <div
            className={cn(
              "pointer-events-none absolute z-10 w-max max-w-[14rem] rounded-lg px-3 py-2 text-left shadow-xl",
              night
                ? "bg-[#0b1220]/95 text-white ring-1 ring-white/15"
                : "bg-white/97 text-foreground ring-1 ring-border",
            )}
            style={{
              left: `${activePin.u * 100}%`,
              top: `${activePin.v * 100}%`,
              transform: `translate(${activePin.u > 0.7 ? "-105%" : "5%"}, ${
                activePin.v > 0.7 ? "-105%" : "5%"
              })`,
            }}
            role="status"
          >
            <p className="text-sm font-medium leading-tight">{activePin.pin.name}</p>
            {activePin.pin.name !== activePin.pin.country_name && (
              <p className={cn("text-xs", night ? "text-white/55" : "text-muted-foreground")}>
                {activePin.pin.country_name}
              </p>
            )}
            <p className={cn("mt-1.5 text-xs", night ? "text-white/75" : "text-muted-foreground")}>
              {activePin.pin.churches > 0 && (
                <>
                  {activePin.pin.churches}{" "}
                  {activePin.pin.churches === 1 ? "church" : "churches"}
                </>
              )}
              {activePin.pin.churches > 0 && activePin.pin.downloads > 0 && " · "}
              {activePin.pin.downloads > 0 && (
                <>
                  {activePin.pin.downloads} desktop{" "}
                  {activePin.pin.downloads === 1 ? "install" : "installs"}
                </>
              )}
              {activePin.pin.churches === 0 && activePin.pin.downloads === 0 && "Placed by hand"}
            </p>
          </div>
        )}
      </div>

      {/* Bottom-right, not top-right. The view opens framed on the pins, and
          for this platform that cluster is the Philippines sitting high in the
          frame -- exactly where a control strip up there covers it.
          Bottom-right is open ocean, and is where map controls conventionally
          live anyway.

          A ROW on phones, a column above them. A column is 110px of a 210px
          tall map: whatever corner it is put in, it covers a third of the
          height and something is behind it. Laid along the bottom edge it is
          one button tall, and the pins sit above it. */}
      <div className="absolute bottom-2 right-2 flex flex-row-reverse gap-1.5 sm:bottom-3 sm:right-3 sm:flex-col">
        {toolbar}
        <MapButton night={night} label="Zoom in" onClick={() => zoomBy(ZOOM_STEP)}>
          <Plus className="h-4 w-4" />
        </MapButton>
        <MapButton night={night} label="Zoom out" onClick={() => zoomBy(1 / ZOOM_STEP)}>
          <Minus className="h-4 w-4" />
        </MapButton>
        <MapButton night={night} label="Reset the view" onClick={resetView}>
          <Maximize2 className="h-4 w-4" />
        </MapButton>
      </div>

      {/* Shown only when somebody scrolls over the map and nothing zooms, so
          that reads as a rule rather than as a broken map. */}
      <div
        aria-hidden="true"
        className={cn(
          "pointer-events-none absolute inset-0 flex items-center justify-center transition-opacity duration-200",
          hint ? "opacity-100" : "opacity-0",
        )}
      >
        <p
          className={cn(
            "rounded-full px-4 py-2 text-sm font-medium shadow-lg backdrop-blur-sm",
            night ? "bg-black/70 text-white" : "bg-foreground/85 text-background",
          )}
        >
          Hold Ctrl and scroll to zoom
        </p>
      </div>
    </div>
  );
}

function MapButton({
  night,
  label,
  onClick,
  children,
}: {
  night: boolean;
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onClick={onClick}
      className={cn(
        "flex h-8 w-8 items-center justify-center rounded-md backdrop-blur transition-colors",
        night
          ? "bg-white/10 text-white/80 ring-1 ring-white/15 hover:bg-white/20 hover:text-white"
          : "bg-white/90 text-foreground ring-1 ring-border hover:bg-white",
      )}
    >
      {children}
    </button>
  );
}

/** Re-exported so callers do not have to reach into ../projection themselves. */
export type { Point, View };
