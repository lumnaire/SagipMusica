import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import {
  CalendarClock,
  CircleCheck,
  Copy,
  KeyRound,
  Lock,
  QrCode,
  ShieldCheck,
  Sparkles,
  Trophy,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { useEventStore } from "@/features/event/store";
import type { EventChallenge } from "@/features/event/api";
import { EventCountdown, formatManilaRange, formatManilaStart } from "./EventCountdown";
import { KeyCelebration } from "./KeyCelebration";
import { useHiddenWord } from "./HiddenToken";
import goldenKey from "@/assets/golden-key.png";
import proQrCode from "@/assets/SagipMusicaPro-QR.png";

/**
 * The 3-Text Hunt board.
 *
 * Before the start it is an announcement with a countdown and a Join button.
 * During the week it is the board: three challenges, one open at a time, each
 * unlocking the next. After the close it is nothing at all — see `visible`.
 *
 * It lives inside a dialog (EventDialog), opened from a quick action, rather
 * than sitting in the dashboard's flow. Full width and half a screen tall, it
 * pushed the stats, the quick actions and the recent songs below the fold —
 * which is the wrong trade for something that runs a week and then leaves. In
 * a dialog it gets the whole screen when it is asked for, and none of it when
 * it is not.
 *
 * The headline is doing double duty. "SagipMusica Pro" is the thing being
 * given away, it is where the three code words come from, and its third word
 * is the answer to the third challenge — inert text for everybody, and the
 * finish line for anyone who has already found the other two. Nothing here
 * says which; the word asks the server the same way every other hiding place
 * does. See HiddenToken.
 */

/** Each code word gets a colour and a number, so the riddles have something to point at. */
const WORD_STYLES = [
  { tag: "1", text: "text-amber-500 dark:text-amber-400", ring: "ring-amber-400/40", chip: "bg-amber-400/15 text-amber-600 dark:text-amber-300" },
  { tag: "2", text: "text-violet-500 dark:text-violet-400", ring: "ring-violet-400/40", chip: "bg-violet-400/15 text-violet-600 dark:text-violet-300" },
  { tag: "3", text: "text-emerald-500 dark:text-emerald-400", ring: "ring-emerald-400/40", chip: "bg-emerald-400/15 text-emerald-600 dark:text-emerald-300" },
] as const;

export function EventBoard() {
  const state = useEventStore((s) => s.state);
  const status = useEventStore((s) => s.status);
  const load = useEventStore((s) => s.load);
  const join = useEventStore((s) => s.join);
  const [joining, setJoining] = useState(false);

  useEffect(() => {
    void load();
  }, [load]);

  const refresh = useCallback(() => {
    void load({ force: true });
  }, [load]);

  if (status === "loading" && !state) {
    return <Skeleton className="h-64 w-full rounded-xl" />;
  }

  // The one check that removes the board: false once the week is up, false
  // when the event is switched off, and false for a signed-out visitor. The
  // server decides it (see 0024) so a browser cannot argue its way back in.
  if (!state?.visible) return null;

  async function handleJoin() {
    setJoining(true);
    try {
      await join();
      toast.success("You're in. Good hunting.");
    } catch (err) {
      console.error(err);
      toast.error(err instanceof Error ? err.message : "Couldn't join the event.");
    } finally {
      setJoining(false);
    }
  }

  const huntOpen = Boolean(state.hunt_open);
  const joined = Boolean(state.joined);
  const completed = Boolean(state.completed);
  const challenges = state.challenges ?? [];
  const slotsLeft = (state.winner_slots ?? 5) - (state.winners_taken ?? 0);

  return (
    <>
      <Header startsAt={state.starts_at} endsAt={state.ends_at} />

      {completed ? (
        <CompletedPanel
          winnerRank={state.winner_rank ?? null}
          winnerSlots={state.winner_slots ?? 5}
          endsAt={state.ends_at}
        />
      ) : huntOpen ? (
        <ChallengeBoard challenges={challenges} joined={joined} />
      ) : (
        <Intro slotsLeft={slotsLeft} winnerSlots={state.winner_slots ?? 5} />
      )}

      <ShareInvite />

      {/* Countdown and join. */}
      <div className="mt-6 border-t border-amber-400/20 pt-5">
        {/* Before the start this counts down to the opening; during the week
            it counts down to the close. Both run off the server's clock, and
            both ask the server again when they hit zero rather than deciding
            for themselves what happens next. */}
        {!huntOpen && state.starts_at ? (
          <>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Starts in
            </p>
            <EventCountdown startsAt={state.starts_at} onElapsed={refresh} />
            <p className="mt-2 text-xs text-muted-foreground">
              {formatManilaStart(state.starts_at)}
            </p>
          </>
        ) : (
          state.ends_at && (
            <>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-amber-600 dark:text-amber-400">
                Closes in
              </p>
              <EventCountdown startsAt={state.ends_at} onElapsed={refresh} />
            </>
          )
        )}

        {state.ends_at && <ClosingNotice endsAt={state.ends_at} completed={completed} />}

        <div className="mt-4 flex flex-wrap items-center gap-3">
          {joined ? (
            <span className="inline-flex items-center gap-2 rounded-full bg-emerald-500/10 px-3 py-1.5 text-sm font-medium text-emerald-600 dark:text-emerald-400">
              <CircleCheck className="h-4 w-4" />
              You're in
            </span>
          ) : (
            <Button
              onClick={() => void handleJoin()}
              disabled={joining}
              className="bg-amber-500 text-neutral-950 hover:bg-amber-400"
            >
              <KeyRound className="h-4 w-4" />
              {joining ? "Joining..." : "Join the hunt"}
            </Button>
          )}

          <span className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
            <Users className="h-4 w-4" />
            <span className="font-semibold text-foreground tabular-nums">
              {state.participants}
            </span>
            {state.participants === 1 ? "player joined" : "players joined"}
          </span>

        </div>
      </div>
    </>
  );
}

/**
 * The headline, with the three code words picked out — and the third of them
 * quietly wired up as challenge 3.
 */
function Header({ startsAt, endsAt }: { startsAt?: string; endsAt?: string }) {
  const { codeWord, celebration, dismiss, claim } = useHiddenWord("event-word", "pro");
  const winnerSlots = useEventStore((s) => s.state?.winner_slots ?? 5);
  const range = startsAt && endsAt ? formatManilaRange(startsAt, endsAt) : "";

  return (
    <>
      <div className="flex items-start gap-4">
        <img
          src={goldenKey}
          alt=""
          className="hidden h-14 w-14 shrink-0 object-contain drop-shadow-[0_0_14px_rgba(245,197,24,0.45)] sm:block"
        />
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="inline-flex items-center gap-1.5 rounded-full bg-amber-400/15 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-amber-600 dark:text-amber-300">
              <Sparkles className="h-3.5 w-3.5" />
              One week only (LIMITED EVENT)
            </p>
            {range && (
              <p className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                <CalendarClock className="h-3.5 w-3.5" />
                {range}
              </p>
            )}
          </div>
          <h2 className="mt-2 font-display text-2xl leading-tight text-foreground sm:text-3xl">
            The{" "}
            <span className={WORD_STYLES[0].text}>
              Sagip
              <sup className="ml-0.5 text-[0.55em] font-bold">1</sup>
            </span>
            <span className={WORD_STYLES[1].text}>
              Musica
              <sup className="ml-0.5 text-[0.55em] font-bold">2</sup>
            </span>{" "}
            {/* Challenge 3 lives here, and gives away nothing.

                This word looks and behaves identically whether or not it is
                the answer: same colour, same default cursor, no ring, no glow,
                no hover, no role, no tabIndex, no aria-label. It used to light
                up the moment an account became eligible, which turned the
                hardest challenge into the easiest -- solve two and the third
                announces itself.

                The handler is attached unconditionally so the DOM is identical
                too. It costs nothing: claim() returns immediately unless the
                server has already confirmed a word is hidden here, so for
                everybody else clicking this is the same as clicking any other
                word in the sentence -- which is to say, nothing at all.

                The trade is real. With no role and no key handler this is not
                reachable by keyboard or announced to a screen reader, which is
                a genuine accessibility cost. It is accepted here because the
                whole point of the challenge is that the word is unmarked, and
                any affordance that makes it reachable also makes it findable.
                Nothing else in the app is hidden this way. */}
            <span
              onClick={() => void claim()}
              className={cn(WORD_STYLES[2].text, "cursor-default select-none")}
            >
              Pro
              <sup className="ml-0.5 text-[0.55em] font-bold">3</sup>
            </span>{" "}
            <span className="text-foreground">3-Text Hunt Challenge</span>
          </h2>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Three words. Three hiding places. Five accounts keep Pro forever.
          </p>
        </div>
      </div>

      <KeyCelebration
        open={celebration !== null}
        codeWord={celebration?.codeWord ?? codeWord}
        completed={celebration?.completed}
        winnerRank={celebration?.winnerRank}
        winnerSlots={winnerSlots}
        onClose={dismiss}
      />
    </>
  );
}

/** What the event is, before it opens. */
function Intro({ slotsLeft, winnerSlots }: { slotsLeft: number; winnerSlots: number }) {
  return (
    <div className="mt-6 space-y-5">
      <p className="text-sm leading-relaxed text-foreground/90">
        Three code words are hidden inside SagipMusica —{" "}
        <span className={cn("font-semibold", WORD_STYLES[0].text)}>[SAGIP]</span>,{" "}
        <span className={cn("font-semibold", WORD_STYLES[1].text)}>[MUSICA]</span> and{" "}
        <span className={cn("font-semibold", WORD_STYLES[2].text)}>[PRO]</span>. Each one sits
        somewhere you already use: your songs, your Bible, your dashboard. Find them{" "}
        <span className="font-semibold">in order</span> — one riddle at a time, and the next
        only opens once you've solved the one before it. You get one week.
      </p>

      <div className="grid gap-3 sm:grid-cols-3">
        {WORD_STYLES.map((style, i) => (
          <div
            key={style.tag}
            className={cn("rounded-xl px-3 py-2.5 ring-1 ring-inset", style.chip, style.ring)}
          >
            <p className="text-[10px] font-bold uppercase tracking-wider opacity-70">
              Challenge {style.tag}
            </p>
            <p className="font-mono text-sm font-bold tracking-wider">
              [{["SAGIP", "MUSICA", "PRO"][i]}]
            </p>
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-amber-400/30 bg-amber-400/5 p-4">
        <p className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <Trophy className="h-4 w-4 text-amber-500" />
          The prize: SagipMusica Pro, permanently — {winnerSlots} accounts only
        </p>
        <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
          The first {winnerSlots} accounts to finish all three challenges unlock{" "}
          <span className="font-medium text-foreground">SagipMusica Pro for life</span>: no
          subscription, no expiry, no renewal — on the account, kept. {slotsLeft} of{" "}
          {winnerSlots} still open.
        </p>
      </div>

      <div className="rounded-xl border border-border bg-muted/40 p-4">
        <p className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <ShieldCheck className="h-4 w-4 text-emerald-500" />
          And if you don't win — nothing changes
        </p>
        <div className="mt-1.5 space-y-2 text-sm leading-relaxed text-muted-foreground">
          <p>
            <span className="font-medium text-foreground">Free stays free.</span> Everything
            you use today — your hymnal, worship sets, the built-in Bible, presenting to a
            screen — stays on the Free plan after this event and after Pro ships. This is not
            a trial that runs out.
          </p>
          <p>
            When Pro is released it will be{" "}
            <span className="font-medium text-foreground">extra features on top</span>, not a
            gate in front of what you already have. Nobody gets asked to pay to keep working
            the way they work now. The hunt is a way to hand five churches those extras
            early, for good — not a countdown to a paywall.
          </p>
        </div>
      </div>
    </div>
  );
}

/**
 * Bring the rest of the team in.
 *
 * The QR is printed on a white plate whatever the theme is. Its modules are
 * red and gold on a transparent background, which a dark dashboard would sit
 * behind and drop the contrast a scanner needs — a QR that only works in light
 * mode is a QR that half the team quietly gives up on.
 */
function ShareInvite() {
  async function copyLink() {
    try {
      await navigator.clipboard.writeText(window.location.origin);
      toast.success("Link copied. Send it to your team.");
    } catch {
      toast.error("Couldn't copy — the address bar has it.");
    }
  }

  return (
    <div className="mt-6 flex flex-col items-center gap-4 rounded-xl border border-violet-400/30 bg-violet-400/5 p-4 sm:flex-row sm:items-center">
      <div className="shrink-0 rounded-xl bg-white p-2 shadow-sm">
        <img
          src={proQrCode}
          alt="QR code linking to SagipMusica"
          className="h-28 w-28 object-contain"
        />
      </div>

      <div className="min-w-0 flex-1 text-center sm:text-left">
        <p className="flex items-center justify-center gap-2 text-sm font-semibold text-foreground sm:justify-start">
          <QrCode className="h-4 w-4 text-violet-500" />
          Bring your AV tech team — and win together
        </p>
        <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
          Three riddles, three different corners of the app. Point your media team, your
          worship leader and whoever runs the projector at this code — the more of you
          hunting, the faster the words turn up. Every one of them can join and play.
        </p>
        <Button variant="outline" size="sm" className="mt-3" onClick={() => void copyLink()}>
          <Copy className="h-4 w-4" />
          Copy link
        </Button>
      </div>
    </div>
  );
}

/**
 * The board is temporary, and says so.
 *
 * Winners get told plainly, because "where did the thing I won go" is a
 * reasonable panic and the answer — the tag on your account, not this card —
 * is worth having in front of them before it happens rather than after.
 */
function ClosingNotice({ endsAt, completed }: { endsAt: string; completed: boolean }) {
  return (
    <p
      className={cn(
        "mt-3 flex items-start gap-2 text-xs leading-relaxed",
        completed ? "text-amber-700 dark:text-amber-300" : "text-muted-foreground",
      )}
    >
      <CalendarClock className="mt-0.5 h-3.5 w-3.5 shrink-0" />
      <span>
        This board is removed from every dashboard when the hunt closes —{" "}
        <span className="font-medium">{formatManilaStart(endsAt)}</span>.
        {completed ? (
          <>
            {" "}
            Your win is not stored here: the <span className="font-semibold">PRO</span> tag
            beside your name stays on the account after the board is gone. Take a screenshot
            if you'd like a keepsake.
          </>
        ) : (
          <> Anything you haven't found by then stays unfound.</>
        )}
      </span>
    </p>
  );
}

/** The board, once the hunt is open. */
function ChallengeBoard({
  challenges,
  joined,
}: {
  challenges: EventChallenge[];
  joined: boolean;
}) {
  if (!joined) {
    return (
      <div className="mt-6 rounded-xl border border-dashed border-amber-400/40 bg-amber-400/5 px-4 py-6 text-center">
        <p className="text-sm font-medium text-foreground">The hunt is live.</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Join below to see your first riddle.
        </p>
      </div>
    );
  }

  return (
    <div className="mt-6 space-y-3">
      {challenges.map((challenge) => {
        const style = WORD_STYLES[challenge.level - 1] ?? WORD_STYLES[0];
        const solved = challenge.status === "solved";
        const open = challenge.status === "open";

        return (
          <motion.div
            key={challenge.level}
            layout
            className={cn(
              "rounded-xl border px-4 py-3.5 transition-colors",
              solved && "border-emerald-500/40 bg-emerald-500/5",
              open && "border-amber-400/50 bg-amber-400/5 shadow-[0_0_24px_-12px_rgba(245,197,24,0.8)]",
              !solved && !open && "border-border bg-muted/30",
            )}
          >
            <div className="flex items-start gap-3">
              <div
                className={cn(
                  "mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold",
                  solved && "bg-emerald-500 text-white",
                  open && "bg-amber-400 text-neutral-950",
                  !solved && !open && "bg-muted text-muted-foreground",
                )}
              >
                {solved ? (
                  <CircleCheck className="h-4 w-4" />
                ) : open ? (
                  challenge.level
                ) : (
                  <Lock className="h-3.5 w-3.5" />
                )}
              </div>

              <div className="min-w-0 flex-1">
                <p
                  className={cn(
                    "font-mono text-sm font-bold tracking-wider",
                    solved ? "text-emerald-600 dark:text-emerald-400" : style.text,
                    !solved && !open && "opacity-50",
                  )}
                >
                  [{challenge.code_word}]
                </p>

                {solved && (
                  <p className="mt-0.5 text-sm text-muted-foreground">
                    Found. Key collected.
                  </p>
                )}

                {open && challenge.prompt && (
                  <>
                    <p className="mt-1 text-sm leading-relaxed text-foreground">
                      {challenge.prompt}
                    </p>
                    {challenge.hint && (
                      <p className="mt-1.5 text-sm italic text-amber-600 dark:text-amber-400">
                        Hint: {challenge.hint}
                      </p>
                    )}
                    <p className="mt-2 text-xs text-muted-foreground">
                      Go and find it. When you're standing on it, it will show itself — click
                      it to claim.
                    </p>
                  </>
                )}

                {!solved && !open && (
                  <p className="mt-0.5 text-sm text-muted-foreground">
                    Locked — finish challenge {challenge.level - 1} first.
                  </p>
                )}
              </div>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}

/** All three found. */
function CompletedPanel({
  winnerRank,
  winnerSlots,
  endsAt,
}: {
  winnerRank: number | null;
  winnerSlots: number;
  endsAt?: string;
}) {
  return (
    <div className="mt-6 rounded-xl border border-amber-400/40 bg-amber-400/10 p-5 text-center">
      <img
        src={goldenKey}
        alt=""
        className="mx-auto h-16 w-16 object-contain drop-shadow-[0_0_18px_rgba(245,197,24,0.6)]"
      />
      <h3 className="mt-3 font-display text-2xl text-foreground">Congratulations!</h3>
      <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
        You found all three — <span className={WORD_STYLES[0].text}>SAGIP</span>,{" "}
        <span className={WORD_STYLES[1].text}>MUSICA</span> and{" "}
        <span className={WORD_STYLES[2].text}>PRO</span> — and finished the hunt.
      </p>
      {winnerRank ? (
        <p className="mt-3 inline-flex items-center gap-2 rounded-full bg-amber-400/20 px-4 py-2 text-sm font-semibold text-amber-700 dark:text-amber-300">
          <Trophy className="h-4 w-4" />
          Finisher #{winnerRank} of {winnerSlots} — SagipMusica Pro is yours, permanently
        </p>
      ) : (
        <p className="mt-3 text-sm text-muted-foreground">
          All {winnerSlots} Pro slots had gone by the time you finished — but the Free plan
          you're on is not going anywhere.
        </p>
      )}
      {endsAt && (
        <p className="mx-auto mt-4 max-w-lg rounded-lg border border-amber-400/30 bg-background/60 px-3 py-2 text-xs leading-relaxed text-muted-foreground">
          {winnerRank ? (
            <>
              <span className="font-semibold text-foreground">Your Pro account is safe.</span>{" "}
              It lives on your profile, not on this card — so when this board is removed after{" "}
              {formatManilaStart(endsAt)}, the{" "}
              <span className="font-semibold">PRO</span> tag beside your name stays exactly
              where it is.
            </>
          ) : (
            <>
              This board is removed after {formatManilaStart(endsAt)}. Nothing you use changes
              — the Free plan carries on as it is.
            </>
          )}
        </p>
      )}
    </div>
  );
}
