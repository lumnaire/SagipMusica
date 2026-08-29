import { AnimatePresence, motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import goldenKey from "@/assets/golden-key.png";
import { Confetti, GoldenKeyBurst } from "./Confetti";

/**
 * What a find looks like: the golden key, a burst of light, and confetti.
 *
 * Shown by whichever screen the word was hidden on, so the moment happens
 * where the player is rather than bouncing them back to the dashboard. The
 * last one — all three found — gets the same overlay with a different ending,
 * because the celebration for finishing should feel like the celebrations that
 * got you there, only bigger.
 *
 * The confetti and the key live in Confetti.tsx, shared with the announcement
 * that opens the event (EventAnnouncement) — the grand entrance and a winning
 * find are the same occasion and should look like it.
 */

interface KeyCelebrationProps {
  open: boolean;
  /** The word that was just found, e.g. "SAGIP". */
  codeWord: string;
  /** True when this was the third and last one. */
  completed?: boolean;
  /** 1..5 when the finish took a prize slot; null when the slots were gone. */
  winnerRank?: number | null;
  winnerSlots?: number;
  onClose: () => void;
}

export function KeyCelebration({
  open,
  codeWord,
  completed = false,
  winnerRank = null,
  winnerSlots = 5,
  onClose,
}: KeyCelebrationProps) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] flex items-center justify-center overflow-hidden bg-black/70 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-label={completed ? "Challenge complete" : `You found ${codeWord}`}
        >
          <Confetti active={open} count={completed ? 70 : 44} />

          <motion.div
            initial={{ scale: 0.85, y: 24, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            transition={{ type: "spring", stiffness: 260, damping: 22 }}
            className="relative flex w-full max-w-md flex-col items-center gap-5 rounded-2xl border border-amber-300/30 bg-neutral-950/80 px-6 py-8 text-center shadow-2xl"
          >
            <GoldenKeyBurst src={goldenKey} />

            {completed ? (
              <>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-300">
                    All three found
                  </p>
                  <h2 className="mt-1 font-display text-3xl text-white">Congratulations!</h2>
                </div>
                <p className="text-sm leading-relaxed text-neutral-300">
                  You completed the{" "}
                  <span className="font-semibold text-white">SagipMusica 3-Text Hunt</span> —
                  <span className="text-amber-300"> SAGIP</span>,
                  <span className="text-violet-300"> MUSICA</span> and
                  <span className="text-emerald-300"> PRO</span>, in that order.
                </p>
                {winnerRank ? (
                  <div className="w-full rounded-xl border border-amber-300/40 bg-amber-400/10 px-4 py-3">
                    <p className="text-sm font-semibold text-amber-200">
                      Finisher #{winnerRank} of {winnerSlots}
                    </p>
                    <p className="mt-1 text-xs text-amber-100/80">
                      SagipMusica Pro is yours, permanently. Your account is already
                      marked Pro — look for the tag beside your name.
                    </p>
                  </div>
                ) : (
                  <div className="w-full rounded-xl border border-white/15 bg-white/5 px-4 py-3">
                    <p className="text-sm font-semibold text-white">
                      All {winnerSlots} Pro slots were taken
                    </p>
                    <p className="mt-1 text-xs text-neutral-300">
                      You still finished the hunt — and the Free plan you are on is not
                      going anywhere.
                    </p>
                  </div>
                )}
              </>
            ) : (
              <>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-300">
                    You found it
                  </p>
                  <h2 className="mt-1 font-display text-3xl text-white">[{codeWord}]</h2>
                </div>
                <p className="text-sm text-neutral-300">
                  One key turned. The next challenge is waiting on your dashboard.
                </p>
              </>
            )}

            <Button
              onClick={onClose}
              className="bg-amber-400 text-neutral-950 hover:bg-amber-300"
            >
              {completed ? "See my badge" : "Next challenge"}
            </Button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
