import React from "react";
// Imported from framer-motion rather than the `motion` package: they are the
// same library under two names, and framer-motion is already a dependency
// (used by smooth-scroll-hero). Adding `motion` too would ship a second copy.
import { motion, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";

export function FloatingPathsBackground({
  position,
  children,
  className,
}: {
  position: number;
  className?: string;
  children: React.ReactNode;
}) {
  const reduceMotion = useReducedMotion();

  const paths = Array.from({ length: 36 }, (_, i) => ({
    id: i,
    d: `M-${380 - i * 5 * position} -${189 + i * 6}C-${
      380 - i * 5 * position
    } -${189 + i * 6} -${312 - i * 5 * position} ${216 - i * 6} ${
      152 - i * 5 * position
    } ${343 - i * 6}C${616 - i * 5 * position} ${470 - i * 6} ${
      684 - i * 5 * position
    } ${875 - i * 6} ${684 - i * 5 * position} ${875 - i * 6}`,
    width: 0.5 + i * 0.03,
  }));

  return (
    <div className={cn("relative w-full", className)}>
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
        <svg
          className="h-full w-full text-primary"
          viewBox="0 0 696 316"
          fill="none"
          preserveAspectRatio="xMidYMid slice"
        >
          {paths.map((path) => (
            <motion.path
              key={path.id}
              d={path.d}
              stroke="currentColor"
              strokeWidth={path.width}
              strokeOpacity={0.06 + path.id * 0.012}
              initial={{ pathLength: 0.3, opacity: 0.6 }}
              animate={
                reduceMotion
                  ? { pathLength: 1, opacity: 0.4 }
                  : {
                      pathLength: 1,
                      opacity: [0.3, 0.6, 0.3],
                      pathOffset: [0, 1, 0],
                    }
              }
              transition={
                reduceMotion
                  ? { duration: 0 }
                  : {
                      duration: 20 + Math.random() * 10,
                      repeat: Number.POSITIVE_INFINITY,
                      ease: "linear",
                    }
              }
            />
          ))}
        </svg>
      </div>
      {children}
    </div>
  );
}
