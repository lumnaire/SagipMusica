import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { KeyRound, Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Reveal } from "@/components/ui/reveal";
import { fetchEventState } from "@/features/event/api";
import { formatManilaRange } from "@/features/event/components/EventCountdown";
import goldenKey from "@/assets/golden-key.png";

/**
 * The event, announced to people who are not signed in yet.
 *
 * Sits straight after the hero because it is the most time-limited thing on
 * the page: a permanent Pro account, for one week, and then never again. The
 * rest of the site explains what SagipMusica is and will still be true next
 * month.
 *
 * It removes itself when the hunt closes, the same way the dashboard board
 * does and for the same reason — a landing page still advertising a finished
 * competition is worse than one that never mentioned it. `visible` is the
 * server's answer (see 0025, which opens event_state() to anon for exactly
 * this: five public facts, no rows), so this is never a date the browser
 * decides for itself.
 *
 * If the call fails the section simply does not render. A marketing page has
 * no business showing an error about an event nobody asked about.
 */
export function ProEventSection() {
  const [window_, setWindow] = useState<{ starts: string; ends: string } | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const state = await fetchEventState();
        if (cancelled || !state.visible || !state.starts_at || !state.ends_at) return;
        setWindow({ starts: state.starts_at, ends: state.ends_at });
      } catch (err) {
        console.error("Could not load the event state", err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!window_) return null;

  const range = formatManilaRange(window_.starts, window_.ends);

  return (
    <section className="relative overflow-hidden border-y border-amber-400/20 bg-gradient-to-b from-amber-50/70 via-background to-background py-20 dark:from-amber-950/25 sm:py-24">
      <div className="mx-auto max-w-5xl px-6">
        <Reveal>
          {/* The keys flank the copy on a wide screen and step out of the way
              on a narrow one, where two decorative images either side of a
              paragraph would leave the paragraph about forty characters wide. */}
          <div className="flex items-center justify-center gap-6 sm:gap-10 lg:gap-14">
            <FlankingKey side="left" />

            <div className="min-w-0 max-w-2xl text-center">
              <p className="inline-flex items-center gap-1.5 rounded-full bg-amber-400/15 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-amber-600 dark:text-amber-300">
                <Trophy className="h-3.5 w-3.5" />
                {range}
              </p>

              <h2 className="mt-4 font-display text-3xl leading-tight text-foreground sm:text-4xl">
                SagipMusica <span className="text-amber-500 dark:text-amber-400">Pro</span> is
                around the corner
              </h2>

              <p className="mx-auto mt-4 max-w-xl text-base leading-relaxed text-muted-foreground">
                And we've prepared some exciting events to go with it — starting with a
                hunt for three code words hidden inside the app.
              </p>

              <p className="mx-auto mt-3 max-w-xl text-lg font-semibold leading-relaxed text-foreground">
                A permanent Pro account to the winners.
              </p>
              <p className="mx-auto mt-1.5 max-w-xl text-base leading-relaxed text-muted-foreground">
                You heard that right — kept for good, no subscription, no expiry. So create
                an account or log in, and join the event.
              </p>

              <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
                <Button asChild size="lg" className="bg-amber-500 text-neutral-950 hover:bg-amber-400">
                  <Link to="/signup">
                    <KeyRound className="h-4 w-4" />
                    Create an account
                  </Link>
                </Button>
                <Button asChild size="lg" variant="outline">
                  <Link to="/login">Log in and join</Link>
                </Button>
              </div>

              <p className="mt-5 text-xs leading-relaxed text-muted-foreground">
                Not a winner? Nothing changes. SagipMusica stays free — Pro adds to it, it
                never puts a gate in front of what you already use.
              </p>
            </div>

            <FlankingKey side="right" />
          </div>
        </Reveal>
      </div>
    </section>
  );
}

/**
 * One of the two keys either side of the copy.
 *
 * They drift very slightly, out of phase with each other, which reads as
 * hanging rather than as an animation demanding attention. Hidden below `lg`,
 * where there is no room for them beside a readable column.
 */
function FlankingKey({ side }: { side: "left" | "right" }) {
  const left = side === "left";
  return (
    <motion.img
      src={goldenKey}
      alt=""
      aria-hidden
      initial={{ opacity: 0, x: left ? -24 : 24, rotate: left ? -18 : 18 }}
      whileInView={{ opacity: 1, x: 0, rotate: left ? -12 : 12 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.7, ease: "backOut", delay: left ? 0 : 0.12 }}
      className={`hidden h-32 w-32 shrink-0 select-none object-contain drop-shadow-[0_0_22px_rgba(245,197,24,0.45)] lg:block xl:h-40 xl:w-40 ${
        left ? "-scale-x-100" : ""
      }`}
    />
  );
}
