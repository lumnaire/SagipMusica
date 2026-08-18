import type { PresentationChannelMessage } from "@/types/presentation";

const CHANNEL_PREFIX = "worship-presentation-";

/**
 * Thin wrapper around BroadcastChannel used for presenter <-> projector sync.
 * Intentionally has zero knowledge of React, Supabase, or the admin UI so the
 * presentation engine can be lifted into a different shell (e.g. Tauri) later.
 */
export class PresentationChannel {
  private channel: BroadcastChannel;

  constructor(sessionId: string) {
    this.channel = new BroadcastChannel(`${CHANNEL_PREFIX}${sessionId}`);
  }

  send(message: PresentationChannelMessage) {
    this.channel.postMessage(message);
  }

  subscribe(handler: (message: PresentationChannelMessage) => void) {
    const listener = (event: MessageEvent<PresentationChannelMessage>) => {
      handler(event.data);
    };
    this.channel.addEventListener("message", listener);
    return () => this.channel.removeEventListener("message", listener);
  }

  close() {
    this.channel.close();
  }
}
