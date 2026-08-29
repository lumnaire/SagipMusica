import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";

/**
 * The falling burst behind every celebratory moment in the event.
 *
 * Pulled out of KeyCelebration when the announcement needed the same fanfare:
 * the grand entrance and a winning find should feel like the same occasion,
 * and two hand-rolled confetti implementations drift apart the first time
 * either is touched.
 */

const CONFETTI_COLORS = [
  "#f5c518", // key gold
  "#fde68a",
  "#a78bfa",
  "#34d399",
  "#fb7185",
  "#60a5fa",
];

interface Confetto {
  left: number;
  delay: number;
  duration: number;
  drift: number;
  rotation: number;
  color: string;
  size: number;
}

function makeConfetti(count: number): Confetto[] {
  return Array.from({ length: count }, () => ({
    left: Math.random() * 100,
    delay: Math.random() * 0.5,
    duration: 2.2 + Math.random() * 1.8,
    drift: (Math.random() - 0.5) * 160,
    rotation: (Math.random() - 0.5) * 900,
    color: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
    size: 6 + Math.random() * 8,
  }));
}

interface ConfettiProps {
  /** Flipping this true starts a fresh burst; it does not re-randomise on renders. */
  active: boolean;
  count?: number;
}

export function Confetti({ active, count = 44 }: ConfettiProps) {
  // A fresh burst per opening, not per render: re-randomising on every parent
  // update would restart the fall halfway down.
  const [burst, setBurst] = useState(0);
  useEffect(() => {
    if (active) setBurst((n) => n + 1);
  }, [active]);

  const confetti = useMemo(
    () => makeConfetti(count),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- burst is the seed
    [count, burst],
  );

  if (!active) return null;

  return (
    // Pointer-events off so it never eats the button underneath it.
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {confetti.map((c, i) => (
        <motion.span
          key={i}
          initial={{ y: "-10vh", x: 0, opacity: 1, rotate: 0 }}
          animate={{ y: "110vh", x: c.drift, opacity: [1, 1, 0], rotate: c.rotation }}
          transition={{ delay: c.delay, duration: c.duration, ease: "linear" }}
          style={{
            left: `${c.left}%`,
            width: c.size,
            height: c.size * 1.6,
            backgroundColor: c.color,
          }}
          className="absolute top-0 rounded-[2px]"
        />
      ))}
    </div>
  );
}

/**
 * The golden key itself, glowing and swinging into place.
 *
 * Shared for the same reason the confetti is: it is the event's one emblem,
 * and it should arrive the same way every time it arrives.
 */
export function GoldenKeyBurst({ src, className }: { src: string; className?: string }) {
  return (
    <div className={className ?? "relative flex h-32 w-32 items-center justify-center"}>
      <motion.div
        animate={{ scale: [1, 1.18, 1], opacity: [0.55, 0.85, 0.55] }}
        transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
        className="absolute inset-0 rounded-full bg-amber-400/40 blur-2xl"
      />
      <motion.img
        src={src}
        alt=""
        initial={{ rotate: -35, scale: 0.4 }}
        animate={{ rotate: [-35, 12, 0], scale: 1 }}
        transition={{ duration: 0.9, ease: "backOut" }}
        className="relative h-28 w-28 object-contain drop-shadow-[0_0_18px_rgba(245,197,24,0.65)]"
      />
    </div>
  );
}
