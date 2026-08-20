import { useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { MonitorPlay, Presentation } from "lucide-react";
import { Reveal } from "@/components/ui/reveal";
import { cn } from "@/lib/utils";

// A short public-domain set, so the demo shows real hymn text rather than
// filler. Matches what a worship set looks like inside the product.
const SECTIONS = [
  {
    label: "Verse 1",
    lines: [
      "Amazing grace, how sweet the sound",
      "That saved a wretch like me",
      "I once was lost, but now am found",
      "Was blind, but now I see",
    ],
  },
  {
    label: "Verse 2",
    lines: [
      "'Twas grace that taught my heart to fear",
      "And grace my fears relieved",
      "How precious did that grace appear",
      "The hour I first believed",
    ],
  },
  {
    label: "Verse 3",
    lines: [
      "Through many dangers, toils and snares",
      "I have already come",
      "'Tis grace hath brought me safe thus far",
      "And grace will lead me home",
    ],
  },
];

const SLIDE_MS = 4200;

export function LiveSlideShowcase() {
  const [index, setIndex] = useState(0);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    if (reduceMotion) return;
    const timer = setInterval(() => {
      setIndex((i) => (i + 1) % SECTIONS.length);
    }, SLIDE_MS);
    return () => clearInterval(timer);
  }, [reduceMotion]);

  const active = SECTIONS[index];

  return (
    <section className="bg-sidebar py-24 text-sidebar-foreground sm:py-32">
      <div className="mx-auto max-w-6xl px-6">
        <Reveal className="mx-auto max-w-2xl text-center">
          <p className="eyebrow text-sidebar-foreground/50">The Sunday view</p>
          <h2 className="mt-4 font-display text-4xl leading-[1.05] text-sidebar-foreground sm:text-5xl">
            One screen for the congregation.
            <br />
            One for you.
          </h2>
          <p className="mt-5 text-base leading-relaxed text-sidebar-foreground/65">
            Send the projector window to your second display and control the
            service from your own. Every change lands instantly — no network
            round-trip, nothing for the congregation to see but the words.
          </p>
        </Reveal>

        <Reveal delay={0.1} className="mt-14">
          {/* Projector output */}
          <figure className="mx-auto max-w-4xl">
            <div className="relative aspect-video overflow-hidden rounded-xl bg-black shadow-2xl ring-1 ring-white/10">
              <AnimatePresence mode="wait">
                <motion.div
                  key={index}
                  initial={reduceMotion ? false : { opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={reduceMotion ? undefined : { opacity: 0 }}
                  transition={{ duration: 0.5, ease: "easeInOut" }}
                  className="absolute inset-0 flex flex-col items-center justify-center gap-2 px-8 text-center sm:gap-3"
                >
                  {active.lines.map((line) => (
                    <p
                      key={line}
                      className="text-[clamp(0.95rem,2.6vw,1.9rem)] font-medium leading-tight text-white"
                    >
                      {line}
                    </p>
                  ))}
                </motion.div>
              </AnimatePresence>

              <div className="absolute left-4 top-4 flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 backdrop-blur-sm">
                <MonitorPlay className="h-3.5 w-3.5 text-white/70" />
                <span className="text-[11px] font-medium text-white/70">
                  Projector
                </span>
              </div>
            </div>
            <figcaption className="sr-only">
              A projected hymn slide cycling through the verses of Amazing Grace.
            </figcaption>
          </figure>

          {/* Presenter rail */}
          <div className="mx-auto mt-5 max-w-4xl">
            <div className="flex items-center gap-2 pb-3">
              <Presentation className="h-3.5 w-3.5 text-sidebar-foreground/40" />
              <span className="text-[11px] font-medium uppercase tracking-[0.14em] text-sidebar-foreground/40">
                Your presenter view
              </span>
            </div>
            <div className="grid grid-cols-3 gap-3">
              {SECTIONS.map((section, i) => {
                const isActive = i === index;
                return (
                  <button
                    key={section.label}
                    type="button"
                    onClick={() => setIndex(i)}
                    aria-label={`Show ${section.label}`}
                    aria-current={isActive}
                    className={cn(
                      "rounded-lg border p-3 text-left transition-colors",
                      isActive
                        ? "border-sidebar-primary/60 bg-white/10"
                        : "border-white/10 bg-white/[0.03] hover:bg-white/[0.07]",
                    )}
                  >
                    <span
                      className={cn(
                        "text-[11px] font-semibold uppercase tracking-wider",
                        isActive
                          ? "text-sidebar-primary"
                          : "text-sidebar-foreground/45",
                      )}
                    >
                      {section.label}
                    </span>
                    <span className="mt-1.5 line-clamp-2 block text-xs leading-snug text-sidebar-foreground/55">
                      {section.lines[0]}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
