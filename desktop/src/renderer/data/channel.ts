import type { PresentationChannelMessage } from "@/types/presentation";

const CHANNEL_PREFIX = "worship-presentation-";

/**
 * Desktop stand-in for src/features/presentation/engine/channel.ts.
 *
 * Same class, same three methods — but the transport is main rather than
 * BroadcastChannel. The presenter and the projector are two separate renderer
 * processes here, and relying on BroadcastChannel to bridge them during a live
 * service is not a risk worth taking; main rebroadcasts to every other window
 * instead (see main/presentation-relay.ts).
 *
 * Like BroadcastChannel, a window never receives its own messages: the relay
 * skips the sender. The presentation store depends on that — it would answer
 * its own `projector-hello` otherwise.
 */
export class PresentationChannel {
  private readonly name: string;
  private unsubscribe: (() => void) | null = null;
  private closed = false;

  constructor(sessionId: string) {
    this.name = `${CHANNEL_PREFIX}${sessionId}`;
  }

  send(message: PresentationChannelMessage) {
    if (this.closed) return;
    window.sagip.presentation.send(this.name, message);
  }

  subscribe(handler: (message: PresentationChannelMessage) => void) {
    // The relay is a single channel carrying every session, so messages for
    // other sessions are filtered out by name here.
    const off = window.sagip.presentation.subscribe((channel, message) => {
      if (channel !== this.name) return;
      handler(message as PresentationChannelMessage);
    });
    this.unsubscribe = off;
    return off;
  }

  close() {
    this.closed = true;
    this.unsubscribe?.();
    this.unsubscribe = null;
  }
}
