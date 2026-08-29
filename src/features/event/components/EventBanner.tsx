import { useState } from "react";
import { KeyRound, Sparkles, X } from "lucide-react";
import { useEventStore } from "@/features/event/store";

/**
 * The announcement bar across the top of the dashboard.
 *
 * This replaced a full-screen celebration that fired on first sign-in. The
 * celebration worked, but it landed on people who had just finished the
 * walkthrough and wanted to get on with their Sunday — an interruption for a
 * promotion, which is the wrong shape for something a church opens on a
 * Saturday night to build a service order. A bar that scrolls its message and
 * closes when you tell it to says the same thing and takes nothing away from
 * you to say it.
 *
 * Dismissal is remembered server-side, on the same row the celebration used
 * (`event_announcement_seen`, migration 0025) — so it is once per account, not
 * once per browser, and closing it on the office desktop keeps it closed on
 * the tablet at the sound desk. To show it again, delete that row:
 * `delete from event_announcement_seen where user_id = '<uuid>'`.
 *
 * It removes itself for good once the hunt closes, along with everything else
 * the event puts on screen.
 */
export function EventBanner() {
  const state = useEventStore((s) => s.state);
  const ackAnnouncement = useEventStore((s) => s.ackAnnouncement);

  /** Closes instantly; the server write is a background detail, not a wait. */
  const [dismissed, setDismissed] = useState(false);

  if (!state?.visible || state.announcement_seen !== false || dismissed) return null;

  function close() {
    setDismissed(true);
    void ackAnnouncement().catch((err) => {
      // Worst case it comes back on the next load. Not worth a toast, and
      // certainly not worth keeping the bar open over.
      console.error("Could not record the event announcement", err);
    });
  }

  return (
    <div className="relative mb-6 overflow-hidden rounded-xl border border-amber-400/40 bg-gradient-to-r from-amber-400/15 via-amber-300/10 to-violet-400/15">
      <div className="flex items-center gap-3 py-2.5 pl-3 pr-11">
        <span className="flex shrink-0 items-center gap-1.5 rounded-full bg-amber-400 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-neutral-950">
          <Sparkles className="h-3 w-3" />
          Limited event
        </span>

        {/* The marquee. Two identical copies of the message and a track that
            slides exactly half its width, so the loop has no seam. */}
        <div className="min-w-0 flex-1 overflow-hidden">
          <div
            className="flex w-max animate-[event-marquee_28s_linear_infinite] items-center gap-16 hover:[animation-play-state:paused]"
            // Pausing on hover is not decoration: the message names where to
            // find the event, and reading that off a moving line is a chore.
          >
            <Message />
            <Message />
          </div>
        </div>
      </div>

      <button
        type="button"
        onClick={close}
        aria-label="Dismiss the event announcement"
        className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-amber-700 transition-colors hover:bg-amber-400/20 dark:text-amber-300"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

/**
 * One pass of the message. Rendered twice by the marquee, so it is
 * `aria-hidden` on the second copy's behalf — the whole bar reads as one
 * announcement to a screen reader, not two.
 */
function Message() {
  return (
    <p className="flex shrink-0 items-center gap-2 whitespace-nowrap text-sm text-foreground">
      <KeyRound className="h-4 w-4 shrink-0 text-amber-500" />
      <span>
        <span className="font-semibold">SagipMusica Pro is around the corner</span> — and
        we've prepared a limited event just for you. Find it under{" "}
        <span className="font-semibold text-amber-600 dark:text-amber-400">Quick Actions</span>
        , then hit <span className="font-semibold">Join</span> to see who else is playing and
        reserve your slot.
      </span>
    </p>
  );
}
