import type { SectionType } from "./database";

/**
 * Fully resolved, presentation-ready view of a single section.
 * The presentation engine only ever consumes this shape — it never
 * knows about Song/SongSection database rows directly.
 */
export interface PresentationSlide {
  id: string; // stable id: `${songId}:${sectionId}`
  songId: string;
  songTitle: string;
  sectionId: string;
  sectionType: SectionType;
  sectionTitle: string;
  lyrics: string;
}

export interface PresentationStyle {
  backgroundColor: string;
  backgroundImageUrl: string | null;
  textColor: string;
  fontFamily: string;
  titleFontSize: number; // px at 1920x1080 reference
  lyricsFontSize: number; // px at 1920x1080 reference
  textAlign: "left" | "center" | "right";
  showTitle: boolean;
  overlayOpacity: number; // 0-1 scrim over background image
}

export const DEFAULT_PRESENTATION_STYLE: PresentationStyle = {
  // Plain black: it matches the blackout mode and the unlit area around the
  // projected image, so nothing shifts tone when the screen is blanked.
  backgroundColor: "#000000",
  backgroundImageUrl: null,
  textColor: "#ffffff",
  fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif",
  titleFontSize: 56,
  lyricsFontSize: 64,
  textAlign: "center",
  showTitle: true,
  overlayOpacity: 0.35,
};

export type PresentationDisplayMode = "live" | "black" | "blank";

/**
 * The full state broadcast from the Presenter window to the Projector
 * window via BroadcastChannel. Kept intentionally small/serializable.
 */
export interface PresentationBroadcastState {
  type: "presentation-state";
  sessionId: string;
  slides: PresentationSlide[];
  currentIndex: number;
  displayMode: PresentationDisplayMode;
  style: PresentationStyle;
  updatedAt: number;
}

export interface PresentationHelloMessage {
  type: "projector-hello";
  sessionId: string;
}

export type PresentationChannelMessage =
  | PresentationBroadcastState
  | PresentationHelloMessage;
