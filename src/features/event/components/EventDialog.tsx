import { KeyRound, Sparkles } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useEventStore } from "@/features/event/store";
import { EventBoard } from "./EventBoard";

/**
 * The event board, in a dialog.
 *
 * On the dashboard it was a full-width card half a screen tall, sitting above
 * the stats — which meant a week-long promotion outranked the things people
 * open the dashboard for every day. Here it gets the whole screen when it is
 * asked for and none of it when it is not, and the dashboard keeps its shape.
 *
 * The dialog is also where challenge 3 hides: the word "Pro" in the board's
 * headline. That works exactly as it did before — HiddenToken asks the server
 * whether anything is here, and being inside a dialog changes nothing about
 * the answer.
 */

interface EventDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EventDialog({ open, onOpenChange }: EventDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* bg-card, and the tint as a layer on top of it.
          
          The gradient used to be the background itself -- and a gradient with
          translucent stops (from-amber-50/70 ... to-violet-50/50) REPLACES the
          opaque bg-card rather than sitting over it, so the dashboard read
          straight through the panel. Painting the tint as its own absolutely
          positioned layer keeps the colour and puts something solid behind it. */}
      <DialogContent className="max-w-3xl overflow-hidden border-amber-400/30 bg-card p-5 sm:p-7">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-gradient-to-br from-amber-100/60 via-transparent to-violet-100/50 dark:from-amber-900/30 dark:to-violet-900/30"
        />

        {/* The board draws its own headline, so these are for screen readers:
            a Radix dialog with no title announces itself as nothing at all. */}
        <DialogTitle className="sr-only">
          The SagipMusica Pro 3-Text Hunt Challenge
        </DialogTitle>
        <DialogDescription className="sr-only">
          A limited event. Find three hidden code words in order for a chance to keep
          SagipMusica Pro permanently.
        </DialogDescription>

        {/* Above the tint layer, which is absolutely positioned and would
            otherwise paint over the board. */}
        <div className="relative max-h-[80vh] overflow-y-auto pr-1">
          <EventBoard />
        </div>
      </DialogContent>
    </Dialog>
  );
}

/**
 * The way in: a quick action beside "Add Song" and "Create Worship Set".
 *
 * Renders nothing at all when there is no event — before it is switched on,
 * after the week closes, and on any build without a server behind it. The
 * quick-actions row is a fixed part of the dashboard and this has to be able
 * to leave it without a gap.
 *
 * Styled against the row rather than with it, on purpose: everything else
 * there is a permanent feature, and this is the one thing that expires.
 */
export function EventQuickAction({ onOpen }: { onOpen: () => void }) {
  const state = useEventStore((s) => s.state);

  if (!state?.visible) return null;

  const joined = Boolean(state.joined);
  const solved = state.solved_levels?.length ?? 0;

  return (
    <Button
      onClick={onOpen}
      data-tour-id="quick-action-event"
      className={cn(
        "relative bg-amber-500 text-neutral-950 hover:bg-amber-400",
        "shadow-[0_0_20px_-6px_rgba(245,197,24,0.9)]",
      )}
    >
      <KeyRound className="h-4 w-4" />
      Limited Event
      {/* One glance, three states: not in yet, playing, finished. */}
      <span className="ml-1 inline-flex items-center gap-1 rounded-full bg-neutral-950/15 px-1.5 py-px text-[10px] font-bold uppercase tracking-wider">
        {state.completed ? (
          "Done"
        ) : joined ? (
          `${solved}/3`
        ) : (
          <>
            <Sparkles className="h-3 w-3" />
            New
          </>
        )}
      </span>
    </Button>
  );
}
