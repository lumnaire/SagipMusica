import { create } from "zustand";
// By its "@/" path, not a relative one: the desktop build swaps this module
// (see desktop/electron.vite.config.ts) and Vite matches aliases on the
// written specifier.
import { useAuthStore } from "@/stores/auth-store";
import {
  ackEventAnnouncement,
  claimSlot,
  fetchEventState,
  joinEvent,
  probeSlot,
  type ClaimResult,
  type EventSlot,
  type EventState,
  type ProbeResult,
} from "@/features/event/api";

/**
 * One copy of the hunt's state, shared by everything that needs it.
 *
 * There are four consumers on three unrelated screens — the dashboard card,
 * the sidebar's tier badge, the song editor and the Bible browser — and they
 * all need the same two facts: is the hunt open, and which level is this
 * account on. Fetching that per screen would mean a round trip on every
 * navigation and four answers that disagree for a second after a solve.
 *
 * The store holds no answers, only progress. Where the words are hidden is not
 * knowable from here; see features/event/api.ts.
 */

interface EventStoreState {
  state: EventState | null;
  status: "idle" | "loading" | "ready" | "error";

  /**
   * server clock − browser clock, in milliseconds.
   *
   * The countdown is rendered from this rather than from Date.now() alone, so
   * a machine with the wrong time (or a deliberately wound-forward one) shows
   * the same remaining time as everyone else. It is a display concern only —
   * whether the hunt is actually open is decided in the database on every
   * probe and every claim, and no value here can talk it round.
   */
  offsetMs: number;

  load: (options?: { force?: boolean }) => Promise<void>;
  join: () => Promise<void>;
  /** Marks the announcement bar as dismissed for this account. */
  ackAnnouncement: () => Promise<void>;
  probe: (slot: EventSlot, context: string) => Promise<ProbeResult>;
  claim: (slot: EventSlot, context: string) => Promise<ClaimResult>;
}

/** The current in-flight load, so eight mounted components make one request. */
let inFlight: Promise<void> | null = null;

function offsetFor(state: EventState): number {
  const server = Date.parse(state.server_now);
  return Number.isNaN(server) ? 0 : server - Date.now();
}

export const useEventStore = create<EventStoreState>((set, get) => ({
  state: null,
  status: "idle",
  offsetMs: 0,

  load: async ({ force = false } = {}) => {
    if (!force && (get().status === "ready" || inFlight)) {
      await inFlight;
      return;
    }

    set({ status: get().state ? get().status : "loading" });

    inFlight = (async () => {
      try {
        const next = await fetchEventState();
        set({ state: next, offsetMs: offsetFor(next), status: "ready" });
      } catch (err) {
        console.error("Could not load the event state", err);
        set({ status: "error" });
      } finally {
        inFlight = null;
      }
    })();

    await inFlight;
  },

  join: async () => {
    const next = await joinEvent();
    set({ state: next, offsetMs: offsetFor(next), status: "ready" });
  },

  ackAnnouncement: async () => {
    const next = await ackEventAnnouncement();
    set({ state: next, offsetMs: offsetFor(next), status: "ready" });
  },

  probe: (slot, context) => probeSlot(slot, context),

  claim: async (slot, context) => {
    const result = await claimSlot(slot, context);
    // A win changes the level, the participant count and, on the last one, the
    // account's tier. The server hands back the whole new state with the
    // result so none of that needs a second round trip.
    if (result.ok && result.state) {
      set({ state: result.state, offsetMs: offsetFor(result.state) });
    }
    // The prize is written to profiles by the same call, and the sidebar's PRO
    // tag reads the profile the auth store is holding. Without this the badge
    // only turns up on the next sign-in, which is a poor moment to learn you
    // won something.
    if (result.ok && result.completed) {
      await useAuthStore.getState().refreshProfile();
    }
    return result;
  },
}));

/**
 * Whether this account can be shown a hidden word right now.
 *
 * The screens that carry a token check this before probing, purely to save the
 * request — the server applies the same test again and is the one that counts.
 */
export function canHunt(state: EventState | null): boolean {
  return Boolean(state?.active && state.joined && state.hunt_open && !state.completed);
}
