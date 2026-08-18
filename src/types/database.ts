export type UserRole = "admin" | "presenter";

export type SectionType =
  | "verse"
  | "chorus"
  | "bridge"
  | "intro"
  | "outro"
  | "refrain"
  | "custom";

export interface Profile {
  id: string;
  email: string;
  name: string | null;
  role: UserRole;
  created_at: string;
  updated_at: string;
}

export interface Song {
  id: string;
  title: string;
  author: string | null;
  composer: string | null;
  category: string | null;
  key: string | null;
  tempo: string | null;
  description: string | null;
  created_at: string;
  updated_at: string;
}

export interface SongSection {
  id: string;
  song_id: string;
  type: SectionType;
  title: string;
  lyrics: string;
  order_index: number;
  created_at: string;
  updated_at: string;
}

export interface WorshipSet {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
  updated_at: string;
}

export interface WorshipSetItem {
  id: string;
  set_id: string;
  song_id: string;
  order_index: number;
  created_at: string;
}

// Composite / hydrated types used across the UI

export interface SongWithSections extends Song {
  sections: SongSection[];
}

export interface WorshipSetItemWithSong extends WorshipSetItem {
  song: SongWithSections;
}

export interface WorshipSetWithSongs extends WorshipSet {
  items: WorshipSetItemWithSong[];
}

export const SECTION_TYPE_LABELS: Record<SectionType, string> = {
  verse: "Verse",
  chorus: "Chorus",
  bridge: "Bridge",
  intro: "Intro",
  outro: "Outro",
  refrain: "Refrain",
  custom: "Custom",
};

export const SONG_CATEGORIES = [
  "Hymn",
  "Praise & Worship",
  "Gospel",
  "Christmas",
  "Easter",
  "Communion",
  "Other",
] as const;
