import { create } from "zustand";
import { PresentationChannel } from "@/features/presentation/engine/channel";
import {
  DEFAULT_PRESENTATION_STYLE,
  type PresentationSlide,
  type PresentationStyle,
  type PresentationDisplayMode,
} from "@/types/presentation";

interface PresentationState {
  sessionId: string | null;
  title: string;
  slides: PresentationSlide[];
  currentIndex: number;
  displayMode: PresentationDisplayMode;
  style: PresentationStyle;
  channel: PresentationChannel | null;

  start: (sessionId: string, title: string, slides: PresentationSlide[]) => void;
  /**
   * Adds slides to the end of a running presentation and returns the index of
   * the first one. Used to drop a passage of scripture into a service that is
   * already going.
   *
   * It deliberately does NOT move to them. There is one cursor in this engine
   * and it is the live one, so jumping would put the new slide on the
   * sanctuary screen the instant it was added — in the middle of whatever song
   * is currently up. The presenter clicks it when they are ready.
   */
  appendSlides: (slides: PresentationSlide[]) => number;
  stop: () => void;
  goTo: (index: number) => void;
  next: () => void;
  previous: () => void;
  first: () => void;
  last: () => void;
  toggleBlack: () => void;
  setDisplayMode: (mode: PresentationDisplayMode) => void;
  updateStyle: (patch: Partial<PresentationStyle>) => void;
}

function broadcastState(state: PresentationState) {
  if (!state.channel || !state.sessionId) return;
  state.channel.send({
    type: "presentation-state",
    sessionId: state.sessionId,
    slides: state.slides,
    currentIndex: state.currentIndex,
    displayMode: state.displayMode,
    style: state.style,
    updatedAt: Date.now(),
  });
}

export const usePresentationStore = create<PresentationState>((set, get) => ({
  sessionId: null,
  title: "",
  slides: [],
  currentIndex: 0,
  displayMode: "live",
  style: DEFAULT_PRESENTATION_STYLE,
  channel: null,

  start: (sessionId, title, slides) => {
    get().channel?.close();
    const channel = new PresentationChannel(sessionId);

    channel.subscribe((message) => {
      if (message.type === "projector-hello") {
        broadcastState(get());
      }
    });

    set({
      sessionId,
      title,
      slides,
      currentIndex: 0,
      displayMode: "live",
      channel,
    });
    broadcastState(get());
  },

  appendSlides: (incoming) => {
    const { slides, currentIndex } = get();
    if (incoming.length === 0) return currentIndex;

    set({ slides: [...slides, ...incoming] });
    broadcastState(get());
    return slides.length;
  },

  stop: () => {
    get().channel?.close();
    set({ sessionId: null, slides: [], channel: null });
  },

  goTo: (index) => {
    const clamped = Math.max(0, Math.min(index, get().slides.length - 1));
    set({ currentIndex: clamped, displayMode: "live" });
    broadcastState(get());
  },

  next: () => {
    const { currentIndex, slides } = get();
    if (currentIndex >= slides.length - 1) return;
    set({ currentIndex: currentIndex + 1, displayMode: "live" });
    broadcastState(get());
  },

  previous: () => {
    const { currentIndex } = get();
    if (currentIndex <= 0) return;
    set({ currentIndex: currentIndex - 1, displayMode: "live" });
    broadcastState(get());
  },

  first: () => {
    set({ currentIndex: 0, displayMode: "live" });
    broadcastState(get());
  },

  last: () => {
    set({ currentIndex: Math.max(0, get().slides.length - 1), displayMode: "live" });
    broadcastState(get());
  },

  toggleBlack: () => {
    set({ displayMode: get().displayMode === "black" ? "live" : "black" });
    broadcastState(get());
  },

  setDisplayMode: (mode) => {
    set({ displayMode: mode });
    broadcastState(get());
  },

  updateStyle: (patch) => {
    set({ style: { ...get().style, ...patch } });
    broadcastState(get());
  },
}));
