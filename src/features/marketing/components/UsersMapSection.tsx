import { Suspense, lazy, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, MapPin as MapPinIcon, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Reveal } from "@/components/ui/reveal";
import { fetchMapPins, type MapPin } from "@/features/map/api";

// The world outline is ~180 kB of path data. Split out so it is fetched when
// somebody scrolls near the bottom of the landing page rather than being part
// of the bundle that has to arrive before the hero paints.
const WorldMap = lazy(() =>
  import("@/features/map/components/WorldMap").then((m) => ({ default: m.WorldMap })),
);

/** How often an open page picks up churches that signed up while it sat there. */
const REFRESH_MS = 60_000;

/**
 * Where SagipMusica is being used, as the last thing before the footer.
 *
 * This used to be a screenshot with a hand-maintained list of countries under
 * it, and the copy had to be careful not to promise that signing up put you on
 * it -- because nothing did. It is now the live answer: every pin is drawn from
 * the location questions in onboarding and in the download survey, resolved to
 * a province or a country by the gazetteer in migration 0018. A church that
 * finishes onboarding is on this map on the next load, so the copy can say so.
 *
 * Dark band on purpose. It closes the page the way the hero opens it, and a
 * lit map reads far better off ink than off ivory.
 *
 * Renders nothing at all when there are no pins or the fetch fails. An empty
 * map under the words "churches around the world" is worse than no section.
 */
export function UsersMapSection() {
  const [pins, setPins] = useState<MapPin[] | null>(null);
  const [near, setNear] = useState(false);
  const sectionRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    let alive = true;
    const load = () => {
      fetchMapPins()
        .then((rows) => {
          if (alive) setPins(rows);
        })
        .catch((err) => {
          // Silent. This is a marketing section; a visitor has no use for the
          // reason it is missing, and the section hides itself below.
          console.error("Could not load map pins", err);
          if (alive) setPins((current) => current ?? []);
        });
    };
    load();
    const timer = window.setInterval(load, REFRESH_MS);
    return () => {
      alive = false;
      window.clearInterval(timer);
    };
  }, []);

  // Start fetching the map chunk a screen early, so it is in place by the time
  // the section is actually reached.
  useEffect(() => {
    const el = sectionRef.current;
    if (!el || near) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) setNear(true);
      },
      { rootMargin: "600px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [near]);

  if (pins !== null && pins.length === 0) return null;

  const churches = pins?.reduce((sum, p) => sum + p.churches, 0) ?? 0;
  const downloads = pins?.reduce((sum, p) => sum + p.downloads, 0) ?? 0;

  // The chips under the map, replacing what used to be a list typed out by
  // hand and re-checked against a screenshot. Countries, biggest first.
  const countries = pins
    ? [
        ...pins
          .reduce((acc, pin) => {
            const total = pin.churches + pin.downloads;
            acc.set(pin.country_name, (acc.get(pin.country_name) ?? 0) + total);
            return acc;
          }, new Map<string, number>())
          .entries(),
      ]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 8)
        .map(([name]) => name)
    : [];

  return (
    <section
      ref={sectionRef}
      className="relative overflow-hidden bg-sidebar py-24 text-white sm:py-32"
    >
      {/* The same soft wash the hero and the download page use, so the dark
          bands across the site are recognisably one family. */}
      <div
        className="pointer-events-none absolute inset-0 opacity-70"
        style={{
          background:
            "radial-gradient(60rem 30rem at 50% -20%, color-mix(in oklch, var(--accent) 20%, transparent), transparent 70%)",
        }}
        aria-hidden="true"
      />

      <div className="relative mx-auto max-w-5xl px-5 sm:px-6">
        <Reveal className="text-center">
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-white/55">
            On the map
          </p>
          <h2 className="mx-auto mt-4 max-w-2xl font-display text-[clamp(1.9rem,6vw,3.25rem)] leading-[1.08]">
            Churches around the world are already singing with it
          </h2>
          <p className="mx-auto mt-5 max-w-xl text-sm leading-relaxed text-white/70 sm:text-base">
            Every pin is a place a congregation told us it worships — from the
            barangay chapels of the Philippines outward. The brighter the pin,
            the more churches are gathered there.
          </p>
        </Reveal>

        <Reveal delay={0.1}>
          <figure className="mt-11 sm:mt-14">
            <div className="overflow-hidden rounded-xl border border-white/15 bg-white/5 p-1 shadow-2xl shadow-black/50 sm:rounded-2xl sm:p-2">
              {/* Taller on a phone than the 16/10 it started at: at that ratio
                  the frame is barely 200px high, which left the pin cluster
                  and the zoom controls fighting over the same corner. */}
              <div className="aspect-[5/4] w-full overflow-hidden rounded-lg sm:aspect-[16/9] sm:rounded-xl">
                {near && pins && pins.length > 0 ? (
                  <Suspense fallback={<MapSkeleton />}>
                    <WorldMap pins={pins} tone="night" className="h-full w-full" />
                  </Suspense>
                ) : (
                  <MapSkeleton />
                )}
              </div>
            </div>

            <figcaption className="mt-6 space-y-4">
              <p className="text-center text-sm text-white/60">
                {churches > 0 && (
                  <>
                    <strong className="font-medium text-white/85">{churches}</strong>{" "}
                    {churches === 1 ? "church" : "churches"}
                  </>
                )}
                {churches > 0 && downloads > 0 && " · "}
                {downloads > 0 && (
                  <>
                    <strong className="font-medium text-white/85">{downloads}</strong>{" "}
                    desktop {downloads === 1 ? "install" : "installs"}
                  </>
                )}
                {(churches > 0 || downloads > 0) && (
                  <>
                    {" "}
                    across{" "}
                    <strong className="font-medium text-white/85">{pins?.length ?? 0}</strong>{" "}
                    {pins?.length === 1 ? "place" : "places"}
                  </>
                )}
              </p>

              {/* The map is only ever as good as the answers behind it, and a
                  congregation that typed "our church" or a bare barangay name
                  is not on it. Said here, next to the map, because this is the
                  moment somebody looks for their own pin and does not find it
                  -- and the fix is theirs to make on the next form they fill
                  in. Deliberately not an apology or an error: nothing has gone
                  wrong, some answers are just too local to place. */}
              <p className="mx-auto flex max-w-xl items-start gap-2.5 rounded-lg border border-white/10 bg-white/5 px-3.5 py-3 text-left text-xs leading-relaxed text-white/60">
                <TriangleAlert
                  className="mt-0.5 h-4 w-4 shrink-0 text-accent"
                  aria-hidden="true"
                />
                <span>
                  <strong className="font-medium text-white/80">
                    Can&apos;t find your church?
                  </strong>{" "}
                  Pins are placed from the location you give us when you sign up or
                  download. Write a city, province or country — &ldquo;Cebu City,
                  Philippines&rdquo; — rather than a street or barangay, and your
                  congregation is recorded on the map.
                </span>
              </p>

              {countries.length > 0 && (
                <div className="flex flex-wrap items-center justify-center gap-2">
                  {countries.map((country) => (
                    <span
                      key={country}
                      className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-[0.6875rem] font-medium text-white/75 sm:text-xs"
                    >
                      <MapPinIcon className="h-3 w-3 shrink-0 text-accent" />
                      {country}
                    </span>
                  ))}
                </div>
              )}
            </figcaption>
          </figure>
        </Reveal>

        <Reveal delay={0.15}>
          <div className="mt-11 flex flex-col items-center gap-3.5 sm:mt-14">
            <Button
              asChild
              size="lg"
              className="h-13 w-full max-w-xs gap-2 rounded-xl text-base shadow-lg shadow-black/25 sm:w-auto sm:px-9"
            >
              <Link to="/signup">
                Put your church on the map
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            <p className="text-center text-sm text-white/55">
              Tell us where you worship when you sign up and your pin appears
              here. Free, for every congregation.
            </p>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

/** Holds the frame's height while the map chunk and the pins are on their way. */
function MapSkeleton() {
  return (
    <div className="h-full w-full animate-pulse bg-white/5" aria-hidden="true" />
  );
}
