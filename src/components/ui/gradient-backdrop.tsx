import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Soft, static colour wash built from the brand tokens. Purely painted —
 * no animation loop and no SVG geometry to recompute — so it stays smooth
 * on low-powered machines and follows the church's accent colour.
 */
export function GradientBackdrop({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("relative isolate overflow-hidden bg-background", className)}>
      <div className="pointer-events-none absolute inset-0 -z-10" aria-hidden="true">
        {/* Primary bloom, upper left */}
        <div
          className="absolute -left-[10%] -top-[25%] h-[42rem] w-[42rem] rounded-full blur-3xl"
          style={{
            background:
              "radial-gradient(closest-side, color-mix(in oklch, var(--primary) 30%, transparent), transparent)",
          }}
        />
        {/* Accent bloom, lower right */}
        <div
          className="absolute -bottom-[30%] -right-[15%] h-[38rem] w-[38rem] rounded-full blur-3xl"
          style={{
            background:
              "radial-gradient(closest-side, color-mix(in oklch, var(--accent) 42%, transparent), transparent)",
          }}
        />
        {/* Cool counterweight, keeps the middle from going muddy */}
        <div
          className="absolute left-[55%] top-[35%] h-[30rem] w-[30rem] rounded-full blur-3xl"
          style={{
            background:
              "radial-gradient(closest-side, color-mix(in oklch, var(--ring) 22%, transparent), transparent)",
          }}
        />
        {/* Lifts the centre so foreground cards keep their contrast */}
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(70% 55% at 50% 45%, color-mix(in oklch, var(--background) 78%, transparent), transparent)",
          }}
        />
      </div>

      {children}
    </div>
  );
}
