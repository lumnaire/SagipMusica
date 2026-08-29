import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { canHunt, useEventStore } from "@/features/event/store";
import type { EventSlot } from "@/features/event/api";
import { KeyCelebration } from "./KeyCelebration";

/**
 * The hidden words, and the machinery for finding one.
 *
 * A screen that could be hiding something mounts this, tells it where it is —
 * `slot` plus whatever it makes of itself as `context` — and forgets about it.
 * The component asks the server whether anything is here, and renders nothing
 * at all unless the answer is yes.
 *
 * It genuinely does not know. There is no list of targets in this file, no
 * comparison against a title or a chapter, nothing to read out of the bundle.
 * That is the whole design: see supabase/migrations/0023_text_hunt_event.sql.
 */

interface Celebration {
  codeWord: string;
  completed: boolean;
  winnerRank: number | null;
}

interface HiddenWord {
  found: boolean;
  codeWord: string;
  claiming: boolean;
  celebration: Celebration | null;
  dismiss: () => void;
  claim: () => Promise<void>;
}

/**
 * Ask whether a word is hidden where the caller is standing, and provide the
 * click that claims it.
 *
 * Used directly by the event card for level 3, whose word is a piece of the
 * headline rather than a badge of its own.
 */
export function useHiddenWord(slot: EventSlot, context: string): HiddenWord {
  const state = useEventStore((s) => s.state);
  const load = useEventStore((s) => s.load);
  const probe = useEventStore((s) => s.probe);
  const claim = useEventStore((s) => s.claim);

  const [codeWord, setCodeWord] = useState<string | null>(null);
  const [claiming, setClaiming] = useState(false);
  const [celebration, setCelebration] = useState<Celebration | null>(null);

  // A token can be the first thing on screen to want the event — the song
  // editor and the Bible are reachable without passing the dashboard.
  useEffect(() => {
    void load();
  }, [load]);

  // Depend on the level rather than on the state object: the store replaces
  // that object on every refresh, and re-probing on each one would spend the
  // per-minute budget on nothing. What actually changes where a word can be is
  // the level, and the screen the user is on.
  const playable = canHunt(state);
  const level = state?.current_level ?? null;

  useEffect(() => {
    if (!playable || !context) {
      setCodeWord(null);
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const result = await probe(slot, context);
        if (cancelled) return;
        setCodeWord(result.present ? (result.code_word ?? "?") : null);
      } catch (err) {
        // A failed probe is indistinguishable from "nothing here" on purpose:
        // an error message that only appeared on the right screen would be a
        // tell worth hunting for.
        console.error(err);
        if (!cancelled) setCodeWord(null);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [slot, context, playable, level, probe]);

  const runClaim = useCallback(async () => {
    if (!codeWord || claiming) return;
    setClaiming(true);
    try {
      const result = await claim(slot, context);
      if (result.ok) {
        setCodeWord(null);
        setCelebration({
          codeWord: result.code_word ?? codeWord,
          completed: Boolean(result.completed),
          winnerRank: result.winner_rank ?? null,
        });
      } else if (result.reason === "cooldown") {
        toast.error("Too many wrong answers. Try again in a few minutes.");
      } else if (result.reason === "not_open") {
        toast.error("The hunt hasn't started yet.");
      } else {
        // The board moved under them — level 2 rotates as people solve it.
        toast.info("That one just moved. Look again.");
        setCodeWord(null);
      }
    } catch (err) {
      console.error(err);
      toast.error("Couldn't reach the server. Try again.");
    } finally {
      setClaiming(false);
    }
  }, [claim, claiming, codeWord, context, slot]);

  return {
    found: codeWord !== null,
    codeWord: codeWord ?? "",
    claiming,
    celebration,
    dismiss: () => setCelebration(null),
    claim: runClaim,
  };
}

interface HiddenTokenProps {
  slot: EventSlot;
  /** What this screen is. Passed straight to the server, never interpreted here. */
  context: string;
  className?: string;
}

/**
 * The badge form: a glinting `[WORD]` that appears in place when it is here.
 *
 * Renders null the rest of the time — including for accounts that have not
 * joined, before the countdown, and after the hunt is finished — so the screen
 * it sits on is unchanged for everybody else.
 */
export function HiddenToken({ slot, context, className }: HiddenTokenProps) {
  const { found, codeWord, claiming, celebration, dismiss, claim } = useHiddenWord(slot, context);
  const winnerSlots = useEventStore((s) => s.state?.winner_slots ?? 5);

  return (
    <>
      {found && (
        <motion.button
          type="button"
          onClick={() => void claim()}
          disabled={claiming}
          initial={{ opacity: 0, scale: 0.6 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: "spring", stiffness: 300, damping: 18 }}
          aria-label={`Claim the hidden word ${codeWord}`}
          className={cn(
            "relative inline-flex shrink-0 items-center gap-1.5 rounded-full border border-amber-400/60",
            "bg-amber-400/15 px-3 py-1.5 font-mono text-xs font-bold tracking-wider text-amber-600",
            "shadow-[0_0_16px_-4px_rgba(245,197,24,0.9)] transition-transform hover:scale-105",
            "disabled:opacity-60 dark:text-amber-300",
            className,
          )}
        >
          {/* A slow shimmer, so it catches the eye on a page of grey text. */}
          <motion.span
            aria-hidden
            animate={{ opacity: [0.25, 0.7, 0.25] }}
            transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
            className="pointer-events-none absolute inset-0 rounded-full bg-amber-300/40 blur-md"
          />
          <span className="relative">[{codeWord}]</span>
        </motion.button>
      )}

      <KeyCelebration
        open={celebration !== null}
        codeWord={celebration?.codeWord ?? ""}
        completed={celebration?.completed}
        winnerRank={celebration?.winnerRank}
        winnerSlots={winnerSlots}
        onClose={dismiss}
      />
    </>
  );
}
