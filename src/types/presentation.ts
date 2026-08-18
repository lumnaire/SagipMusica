import type { SectionType } from "./database";

/**
 * Fully resolved, presentation-ready view of a single section.
 * The presentation engine only ever consumes this shape — it never
 * knows about Song/SongSection/SectionMedia database rows directly.
 */
export interface PresentationSlide {
  id: string; // stable id: `${songId}:${sectionId}`
  songId: string;
  songTitle: string;
  sectionId: string;
  sectionType: SectionType;
  sectionTitle: string;
  lyrics: string;
  notationUrl: string | null;
  notationCrop: {
    x: number;
    y: number;
    width: number;
    height: number;
    scale: number;
  } | null;
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
  notationPosition: "top" | "middle" | "bottom";
  notationMaxWidthPct: number; // % of canvas width
  overlayOpacity: number; // 0-1 scrim over background image
}

export const DEFAULT_PRESENTATION_STYLE: PresentationStyle = {
  backgroundColor: "#0b0d12",
  backgroundImageUrl: null,
  textColor: "#f5f3ec",
  fontFamily: "'Source Serif 4', Georgia, serif",
  titleFontSize: 56,
  lyricsFontSize: 64,
  textAlign: "center",
  showTitle: true,
  notationPosition: "top",
  notationMaxWidthPct: 70,
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
