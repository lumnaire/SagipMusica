export type UserRole = "admin" | "presenter" | "superadmin";

export type SectionType =
  | "verse"
  | "chorus"
  | "bridge"
  | "intro"
  | "outro"
  | "refrain"
  | "custom";

export type ReferralSource =
  | "facebook"
  | "youtube"
  | "linkedin"
  | "instagram"
  | "friend"
  | "other";

export interface Church {
  id: string;
  name: string;
  referral_source: ReferralSource | null;
  accent_color: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface Profile {
  id: string;
  church_id: string | null;
  email: string;
  name: string | null;
  role: UserRole;
  onboarding_completed: boolean;
  created_at: string;
  updated_at: string;
}

export interface Song {
  id: string;
  church_id: string;
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
  church_id: string;
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
  church_id: string;
  name: string;
  description: string | null;
  created_at: string;
  updated_at: string;
}

export interface WorshipSetItem {
  id: string;
  church_id: string;
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

export const REFERRAL_SOURCE_LABELS: Record<ReferralSource, string> = {
  facebook: "Facebook",
  youtube: "YouTube",
  linkedin: "LinkedIn",
  instagram: "Instagram",
  friend: "A friend recommended it",
  other: "Other",
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
