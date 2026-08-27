/**
 * Fully resolved, presentation-ready slides.
 *
 * The presentation engine only ever consumes these shapes — it never knows
 * about Song, SongSection or BibleVerse rows directly. Everything that has to
 * decide how a slide is *named* or *grouped* has already been decided by the
 * time a slide reaches here, in loadPresentation.ts, so the presenter list and
 * the projector canvas both read the same answer instead of each working it
 * out from the underlying row and drifting apart.
 */
import type { SectionType } from "./database";

interface SlideBase {
  /** Stable and unique within a presentation. */
  id: string;
  /**
   * Consecutive slides sharing a groupId are one heading in the presenter's
   * list — a song, or a passage of scripture. This is what the list groups on;
   * it deliberately does not care which of those it is.
   */
  groupId: string;
  /** The heading itself: "Amazing Grace", or "John 3:16-18". */
  groupTitle: string;
  /** How this one slide is named under that heading: "Verse 2", "v.17". */
  label: string;
  /** A line of what is on the slide, shown under the label. */
  preview: string;
}

/** The opening card for a song: its name and author, no lyrics. */
export interface SongTitleSlide extends SlideBase {
  kind: "title";
  songTitle: string;
  songAuthor: string | null;
}

export interface LyricsSlide extends SlideBase {
  kind: "lyrics";
  songTitle: string;
  sectionType: SectionType;
  lyrics: string;
}

/**
 * One verse of scripture, or a few shown together. The reference is carried on
 * the slide rather than derived from the group heading because it is printed
 * on the projected image — the congregation needs to know what is being read,
 * and a passage spanning several slides has a different reference on each.
 */
export interface ScriptureSlide extends SlideBase {
  kind: "scripture";
  /** As cited: "John 3:16", or "John 3:16-17" where two verses share a slide. */
  reference: string;
  /** The translation's abbreviation — "KJV". */
  translation: string;
  text: string;
}

export type PresentationSlide = SongTitleSlide | LyricsSlide | ScriptureSlide;

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
  // Off: each song already opens with its own title slide, so repeating the
  // name above every verse only steals room from the words. Turn on under
  // Display Settings if you want it on each page as well.
  showTitle: false,
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
