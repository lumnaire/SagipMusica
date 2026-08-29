import { useEffect, useRef, useState } from "react";
import { useEventStore } from "@/features/event/store";

/**
 * The countdown to the event window: 8am Philippine time, 14 to 21
 * September 2026.
 *
 * Counted against the database's clock, not the browser's. The store keeps the
 * difference between the two (see offsetMs) and every tick adds it back, so
 * winding the machine's clock forward moves nothing — and neither does editing
 * these numbers in devtools, because they are a picture of a decision that is
 * made in Postgres on every probe and every claim.
 *
 * When it reaches zero it asks the server once, rather than assuming: the
 * server is what decides whether the hunt has opened.
 */

interface Part {
  label: string;
  value: number;
}

function partsFor(msRemaining: number): Part[] {
  const total = Math.max(0, Math.floor(msRemaining / 1000));
  return [
    { label: "Days", value: Math.floor(total / 86400) },
    { label: "Hours", value: Math.floor((total % 86400) / 3600) },
    { label: "Minutes", value: Math.floor((total % 3600) / 60) },
    { label: "Seconds", value: total % 60 },
  ];
}

interface EventCountdownProps {
  /** ISO timestamp from the server. */
  startsAt: string;
  /** Called once, when the countdown first crosses zero. */
  onElapsed?: () => void;
}

export function EventCountdown({ startsAt, onElapsed }: EventCountdownProps) {
  const offsetMs = useEventStore((s) => s.offsetMs);
  const target = Date.parse(startsAt);

  const [remaining, setRemaining] = useState(() => target - (Date.now() + offsetMs));
  const firedRef = useRef(false);

  useEffect(() => {
    firedRef.current = false;
  }, [startsAt]);

  useEffect(() => {
    function tick() {
      const next = target - (Date.now() + offsetMs);
      setRemaining(next);
      if (next <= 0 && !firedRef.current) {
        firedRef.current = true;
        onElapsed?.();
      }
    }

    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [target, offsetMs, onElapsed]);

  const parts = partsFor(remaining);

  return (
    <div className="grid grid-cols-4 gap-2 sm:gap-3">
      {parts.map((part) => (
        <div
          key={part.label}
          className="rounded-xl border border-amber-400/25 bg-amber-400/5 px-2 py-3 text-center"
        >
          <p className="font-display text-2xl tabular-nums text-foreground sm:text-3xl">
            {String(part.value).padStart(2, "0")}
          </p>
          <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground sm:text-xs">
            {part.label}
          </p>
        </div>
      ))}
    </div>
  );
}

/**
 * "Saturday, 14 September 2026 at 12:00 AM (PHT)" — written in Manila time
 * whatever the reader's own zone is, because that is the time the event
 * actually starts at and the one every announcement will quote.
 */
export function formatManilaStart(startsAt: string): string {
  const date = new Date(startsAt);
  if (Number.isNaN(date.getTime())) return "";
  return `${new Intl.DateTimeFormat("en-PH", {
    timeZone: "Asia/Manila",
    dateStyle: "full",
    timeStyle: "short",
  }).format(date)} (Philippine time)`;
}

/**
 * "14–21 September 2026" — the week the hunt runs for, in Manila time.
 *
 * Collapses to one month and one year when both ends share them, which for a
 * one-week event they almost always do; the long form is there so a window
 * that straddles a month boundary still reads correctly rather than claiming
 * the wrong one.
 */
export function formatManilaRange(startsAt: string, endsAt: string): string {
  const start = new Date(startsAt);
  const end = new Date(endsAt);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return "";

  const part = (date: Date, options: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat("en-PH", { timeZone: "Asia/Manila", ...options }).format(date);

  const sameMonth =
    part(start, { month: "long", year: "numeric" }) ===
    part(end, { month: "long", year: "numeric" });

  return sameMonth
    ? `${part(start, { day: "numeric" })}–${part(end, { day: "numeric" })} ${part(end, {
        month: "long",
        year: "numeric",
      })}`
    : `${part(start, { day: "numeric", month: "long" })} – ${part(end, {
        day: "numeric",
        month: "long",
        year: "numeric",
      })}`;
}
