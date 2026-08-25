import { useEffect, useState } from "react";
import {
  animate,
  motion,
  useMotionValue,
  useMotionValueEvent,
  useReducedMotion,
  useScroll,
  useTransform,
} from "framer-motion";
import { fetchPublicStats, type PublicStats } from "@/features/marketing/api";

/**
 * Where in the hero's scroll the counters take over, as a fraction of its
 * scroll height. The image finishes opening to full bleed at 1.0, so these sit
 * just behind it: the numbers are already settling as the last of the frame
 * comes away, rather than arriving after it and reading as a separate section.
 */
const REVEAL_START = 0.6;
const REVEAL_END = 0.88;

/** Counting starts a shade before the panel is visible, so the digits are
    already in motion when it fades up instead of sitting still and then
    jumping. */
const COUNT_TRIGGER = 0.56;

const COUNT_DURATION = 1.9;

const CARDS: { key: keyof PublicStats; label: string }[] = [
  { key: "accounts", label: "Accounts created" },
  { key: "churches", label: "Churches" },
  { key: "desktop_downloads", label: "Desktop downloads" },
  { key: "songs", label: "Songs created" },
  { key: "worship_sets", label: "Worship sets" },
];

/**
 * A number that counts up to its value once, when `active` turns true.
 *
 * The easing is the expo curve the rest of the site uses: most of the distance
 * is covered early and the last hundred crawl in, which is what makes a
 * counter feel like it is arriving somewhere rather than ticking over.
 */
function CountUp({ value, active }: { value: number; active: boolean }) {
  const count = useMotionValue(0);
  const display = useTransform(count, (v) => Math.round(v).toLocaleString());
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    if (!active) return;
    if (reduceMotion) {
      count.set(value);
      return;
    }
    const controls = animate(count, value, {
      duration: COUNT_DURATION,
      ease: [0.16, 1, 0.3, 1],
    });
    return () => controls.stop();
  }, [active, value, count, reduceMotion]);

  return <motion.span>{display}</motion.span>;
}

/**
 * The closing beat of the hero: as the hymnal photo finishes opening, the
 * headline is long gone and these take its place over the full-bleed image.
 *
 * Pinned with `sticky` rather than parked at a fixed offset, so it holds still
 * in the middle of the screen for the last stretch of the hero and then leaves
 * with the whole section. The panel and the image are driven by the same
 * scrollY, which is what keeps them in step at any scroll speed.
 *
 * Renders nothing at all when the numbers are unavailable or still zero. A hero
 * that announces "0 churches" is worse than a hero that announces nothing.
 */
export function HeroStats({ scrollHeight }: { scrollHeight: number }) {
  const { scrollY } = useScroll();
  const reduceMotion = useReducedMotion();
  const [stats, setStats] = useState<PublicStats | null>(null);
  const [counting, setCounting] = useState(false);

  useEffect(() => {
    let alive = true;
    fetchPublicStats()
      .then((rows) => {
        if (alive) setStats(rows);
      })
      .catch((err) => {
        // Silent on purpose. This is decoration on a marketing page; a visitor
        // has no use for the reason it is missing.
        console.error("Could not load public stats", err);
      });
    return () => {
      alive = false;
    };
  }, []);

  const opacity = useTransform(
    scrollY,
    [scrollHeight * REVEAL_START, scrollHeight * REVEAL_END],
    [0, 1],
  );
  const y = useTransform(
    scrollY,
    [scrollHeight * REVEAL_START, scrollHeight * REVEAL_END],
    [56, 0],
  );

  useMotionValueEvent(scrollY, "change", (latest) => {
    if (!counting && latest >= scrollHeight * COUNT_TRIGGER) setCounting(true);
  });

  const total = stats
    ? CARDS.reduce((sum, card) => sum + (stats[card.key] ?? 0), 0)
    : 0;
  if (!stats || total === 0) return null;

  return (
    <div className="pointer-events-none absolute inset-0 z-10">
      <motion.div
        style={reduceMotion ? undefined : { opacity, y }}
        className="sticky top-0 flex h-screen w-full items-center justify-center px-5 sm:px-6"
      >
        <div className="w-full max-w-5xl text-center">
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-white/60 drop-shadow-[0_1px_8px_rgba(0,0,0,0.8)]">
            SagipMusica so far
          </p>

          <div className="mt-6 grid grid-cols-2 gap-2.5 sm:mt-8 sm:grid-cols-3 sm:gap-3.5 lg:grid-cols-5">
            {CARDS.map((card, i) => (
              <div
                key={card.key}
                className={
                  "rounded-xl border border-white/15 bg-white/10 px-3 py-5 backdrop-blur-md sm:px-4 sm:py-6" +
                  // Five cards into two columns leaves the last one alone in
                  // its row; let it take the full width instead of floating.
                  (i === CARDS.length - 1 ? " col-span-2 sm:col-span-1" : "")
                }
              >
                <p className="font-display text-[clamp(1.75rem,6vw,2.75rem)] leading-none tabular-nums text-white drop-shadow-[0_2px_14px_rgba(0,0,0,0.5)]">
                  <CountUp value={stats[card.key] ?? 0} active={counting} />
                </p>
                <p className="mt-2.5 text-[0.6875rem] font-medium uppercase leading-tight tracking-[0.12em] text-white/65 sm:text-xs">
                  {card.label}
                </p>
              </div>
            ))}
          </div>
        </div>
      </motion.div>
    </div>
  );
}
