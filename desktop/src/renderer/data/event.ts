import type {
  ClaimResult,
  EventSlot,
  EventState,
  ProbeResult,
} from "@/features/event/api";

export type { ClaimResult, EventSlot, EventState, ProbeResult };
export type { ChallengeStatus, EventChallenge } from "@/features/event/api";

/**
 * Desktop stand-in for src/features/event/api.ts.
 *
 * The 3-Text Hunt is a hosted-app event: it needs accounts to award a prize
 * to, one shared clock to count down from, and a server to hold the answers.
 * None of those exist here — this build has no accounts and a database on the
 * user's own machine, where "the answers are not in the client" is not a
 * sentence that can be true.
 *
 * This module exists because the two screens carrying a hidden word — the song
 * editor and the Bible browser — are shared with the web app verbatim. Without
 * it their import of the real module would pull the Supabase client into a
 * build that has no Supabase and take the renderer down at load. It reports
 * the event as switched off, which is the same answer the web app gets when
 * event_settings.is_active is false, and every one of those screens already
 * knows how to render nothing.
 */

const INACTIVE: EventState = {
  active: false,
  visible: false,
  server_now: new Date().toISOString(),
  joined: false,
  participants: 0,
};

function inactive(): Promise<EventState> {
  return Promise.resolve({ ...INACTIVE, server_now: new Date().toISOString() });
}

export const fetchEventState = inactive;
export const joinEvent = inactive;
export const startEventPreview = inactive;
export const resetMyEventProgress = inactive;

export function probeSlot(_slot: EventSlot, _context: string): Promise<ProbeResult> {
  return Promise.resolve({ present: false });
}

export function claimSlot(_slot: EventSlot, _context: string): Promise<ClaimResult> {
  return Promise.resolve({ ok: false, reason: "not_open" });
}
