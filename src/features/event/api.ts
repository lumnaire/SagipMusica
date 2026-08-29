import { supabase } from "@/lib/supabase/client";

/**
 * The 3-Text Hunt's data layer.
 *
 * Every call here is a SECURITY DEFINER function, and that is deliberate:
 * nothing in this feature reads a table. The event tables have no SELECT grant
 * at all, so the answers to the hunt cannot be fetched, guessed at through
 * PostgREST, or read out of a network tab. See
 * supabase/migrations/0023_text_hunt_event.sql for the reasoning in full.
 *
 * The one rule to keep when editing this file: never put a location in it. The
 * client asks "is anything hidden where I am standing" and is answered yes or
 * no; it must never contain the list of places worth standing.
 */

/** Where a screen can ask about. These three strings are the whole vocabulary. */
export type EventSlot = "song-editor" | "bible-chapter" | "event-word";

export type ChallengeStatus = "solved" | "open" | "locked";

export interface EventChallenge {
  level: number;
  code_word: string;
  status: ChallengeStatus;
  /** Null while the level is locked — the server withholds it until reached. */
  prompt: string | null;
  hint: string | null;
}

export interface EventState {
  active: boolean;
  /**
   * Whether the dashboard board should be on the page at all.
   *
   * False once the week is up, and false when the event is switched off. The
   * server decides it rather than the client comparing dates, so a browser
   * with a wrong clock cannot render a board that is over -- and switching the
   * event off clears it everywhere without a deploy.
   */
  visible: boolean;
  /** The database's clock. The countdown ticks from this, never from Date.now(). */
  server_now: string;
  starts_at?: string;
  /** When the hunt closes and the board goes away. */
  ends_at?: string;
  has_started?: boolean;
  has_ended?: boolean;

  /**
   * Whether the server would still accept a preview.
   *
   * Off in production (0027). Kept on the type because event_state() still
   * reports it and it is the flag to check if the hunt ever needs opening
   * early for a rehearsal.
   */
  preview_available?: boolean;
  preview?: boolean;
  /** The only field that says the hunt is playable. Mirrors the server's own gate. */
  hunt_open?: boolean;

  joined: boolean;
  participants: number;

  /**
   * Whether this account has already been shown the grand entrance.
   *
   * True for a signed-out visitor too, so the landing page never tries to
   * announce anything to somebody with no account to remember it against.
   */
  announcement_seen?: boolean;

  solved_levels?: number[];
  current_level?: number | null;
  completed?: boolean;
  winner_rank?: number | null;
  winner_slots?: number;
  winners_taken?: number;

  subscription?: "free" | "pro";
  challenges?: EventChallenge[];
}

export interface ProbeResult {
  present: boolean;
  level?: number;
  code_word?: string;
  /** Set when the per-minute probe budget is spent. */
  throttled?: boolean;
}

export interface ClaimResult {
  ok: boolean;
  reason?: "not_joined" | "not_open" | "wrong" | "cooldown" | "already_complete";
  level?: number;
  code_word?: string;
  completed?: boolean;
  winner_rank?: number | null;
  state?: EventState;
}

/**
 * Fills in fields an older event_state() would not have sent.
 *
 * `visible` and `announcement_seen` each arrived in a later migration, and
 * every one of 0023-0025 redefines the whole function — so a database where
 * they were applied out of order (easy to do by hand in the SQL editor) serves
 * a payload missing them. Read raw, `visible` comes back undefined, the
 * dashboard treats that as "no event", and the whole feature disappears while
 * every table and row is perfectly intact. That is a horrible thing to debug
 * from the UI, so it is repaired here instead.
 *
 * Both fallbacks are chosen to fail towards the harmless answer: derive
 * visibility from what the older payload does say, and assume the entrance has
 * already been shown, because a database that cannot record the acknowledgment
 * would otherwise replay the celebration on every single load.
 *
 * Run 0026 to put the server right; this keeps the app working until then.
 */
function normalize(raw: EventState): EventState {
  return {
    ...raw,
    visible: raw.visible ?? (raw.active && raw.has_ended !== true),
    announcement_seen: raw.announcement_seen ?? true,
  };
}

export async function fetchEventState(): Promise<EventState> {
  const { data, error } = await supabase.rpc("event_state");
  if (error) throw error;
  return normalize(data as unknown as EventState);
}

export async function joinEvent(): Promise<EventState> {
  const { data, error } = await supabase.rpc("event_join");
  if (error) throw error;
  return normalize(data as unknown as EventState);
}

/**
 * Remember that this account has dismissed the announcement bar.
 *
 * One way only: there is no un-acknowledge. Clearing it for a rehearsal is a
 * SQL job — `delete from event_announcement_seen where user_id = ...`.
 */
export async function ackEventAnnouncement(): Promise<EventState> {
  const { data, error } = await supabase.rpc("event_ack_announcement");
  if (error) throw error;
  return normalize(data as unknown as EventState);
}

/**
 * "Am I standing on anything?"
 *
 * `context` is whatever the screen makes of itself — a song title, a
 * `book:chapter` pair, a word. The caller does not know, and must not try to
 * work out, which value would be the right one.
 */
export async function probeSlot(slot: EventSlot, context: string): Promise<ProbeResult> {
  const { data, error } = await supabase.rpc("event_probe", {
    p_slot: slot,
    p_context: context,
  });
  if (error) throw error;
  return data as unknown as ProbeResult;
}

/** "I found it, here." Re-validated from scratch server-side. */
export async function claimSlot(slot: EventSlot, context: string): Promise<ClaimResult> {
  const { data, error } = await supabase.rpc("event_claim", {
    p_slot: slot,
    p_context: context,
  });
  if (error) throw error;
  const result = data as unknown as ClaimResult;
  return result.state ? { ...result, state: normalize(result.state) } : result;
}
