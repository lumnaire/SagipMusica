import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase/client";

const CHANNEL_NAME = "online-users";

/**
 * Tracks who currently has the app open, using Supabase Realtime Presence.
 *
 * One channel instance is shared for the whole tab: every signed-in user
 * announces themselves on it, and the superadmin dashboard reads the same
 * channel's presence state to count them. Two live channels on one topic in a
 * single client is unreliable, hence the singleton.
 *
 * The payload carries no personal data -- just the user's own id and a
 * timestamp. Any signed-in user could subscribe and count how many people are
 * online; nothing beyond that is exposed.
 *
 * Note the count is of distinct *people*, not tabs or sessions: the presence
 * key is the user id, so one person with three tabs open counts once. Sessions
 * also live in localStorage, which is shared across tabs of the same browser
 * profile -- signing into a second account there replaces the first rather
 * than adding to the count. Two people genuinely online means two browsers.
 */
export type PresenceStatus = "idle" | "connecting" | "live" | "error";

interface PresenceSnapshot {
  count: number;
  status: PresenceStatus;
}

let channel: RealtimeChannel | null = null;
let currentUserId: string | null = null;
let status: PresenceStatus = "idle";

type Listener = (snapshot: PresenceSnapshot) => void;
const listeners = new Set<Listener>();

function snapshot(): PresenceSnapshot {
  const count = channel && status === "live"
    ? Object.keys(channel.presenceState()).length
    : 0;
  return { count, status };
}

function emit() {
  const next = snapshot();
  listeners.forEach((fn) => fn(next));
}

export function startPresence(userId: string) {
  if (channel && currentUserId === userId) return;
  stopPresence();

  currentUserId = userId;
  status = "connecting";
  emit();

  channel = supabase.channel(CHANNEL_NAME, {
    config: { presence: { key: userId } },
  });

  channel
    .on("presence", { event: "sync" }, emit)
    .on("presence", { event: "join" }, emit)
    .on("presence", { event: "leave" }, emit)
    .subscribe((subscribeStatus) => {
      if (subscribeStatus === "SUBSCRIBED") {
        status = "live";
        void channel?.track({ online_at: new Date().toISOString() });
        // Emit straight away: a listener that attached before the channel
        // existed is still showing "connecting" and there may be no further
        // sync event if nobody else joins or leaves.
        emit();
      } else if (subscribeStatus === "CHANNEL_ERROR" || subscribeStatus === "TIMED_OUT") {
        status = "error";
        emit();
      } else if (subscribeStatus === "CLOSED") {
        status = "idle";
        emit();
      }
    });
}

export function stopPresence() {
  if (!channel) return;
  void supabase.removeChannel(channel);
  channel = null;
  currentUserId = null;
  status = "idle";
  emit();
}

/** Subscribe to the live snapshot. Returns an unsubscribe function. */
export function subscribeToPresence(listener: Listener): () => void {
  listeners.add(listener);
  listener(snapshot());
  return () => {
    listeners.delete(listener);
  };
}
