export type UserRole = "admin" | "presenter" | "superadmin" | "encoder";

/** Draft templates are visible only to encoders; publishing exposes them to admins. */
export type TemplateStatus = "draft" | "published";

/**
 * Whether the lyrics on a template are safe to reproduce. `metadata_only` means
 * the song is deliberately shipped without words because it is still under
 * copyright — the church adds them under its own CCLI licence.
 */
export type CopyrightStatus = "public_domain" | "licensed" | "metadata_only";

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
  /** Set when the song was copied in from the shared library; null if hand-written. */
  source_template_id: string | null;
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

/**
 * A song in the shared library, maintained by an encoder. Unlike a Song it has
 * no church_id — it belongs to the platform, and an admin adding it to their
 * hymnal gets a copy they own outright.
 */
export interface HymnTemplate {
  id: string;
  title: string;
  author: string | null;
  composer: string | null;
  category: string | null;
  key: string | null;
  tempo: string | null;
  description: string | null;
  status: TemplateStatus;
  is_starter: boolean;
  copyright_status: CopyrightStatus;
  order_index: number;
  created_at: string;
  updated_at: string;
  updated_by: string | null;
}

export interface HymnTemplateSection {
  id: string;
  template_id: string;
  type: SectionType;
  title: string;
  lyrics: string;
  order_index: number;
}

// Composite / hydrated types used across the UI

export interface SongWithSections extends Song {
  sections: SongSection[];
}

export interface HymnTemplateWithSections extends HymnTemplate {
  sections: HymnTemplateSection[];
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

export const COPYRIGHT_STATUS_LABELS: Record<CopyrightStatus, string> = {
  public_domain: "Public domain",
  licensed: "Licensed — churches need CCLI cover",
  metadata_only: "No lyrics — still under copyright",
};

/**
 * Alphabetical, with the two catch-alls pinned to the end. The list grew from
 * seven to thirty-three when the FBC hymnal was imported (0013): its taxonomy
 * is far more useful for finding a song than "Hymn" was, so it was adopted
 * rather than flattened. Three of its names duplicated ours and were folded in
 * on import — "Praise and Worship", "Hymns" and "Gospel Songs".
 *
 * songs.category is plain text with no CHECK constraint, so this list drives
 * the pickers only; it is not a database enum.
 */
export const SONG_CATEGORIES = [
  "Adoration and Majesty of God",
  "Advent",
  "Assurance",
  "Children's Hymns",
  "Christian Life and Discipleship",
  "Christmas",
  "Comfort and Hope",
  "Communion",
  "Consecration and Service",
  "Cross and Blood",
  "Death and Resurrection",
  "Easter",
  "Faith and Trust",
  "Funeral and Comfort in Sorrow",
  "Gospel",
  "Grace and Mercy",
  "Guidance and Providence",
  "Heaven and Eternity",
  "Holy Spirit",
  "Hymn",
  "Invitation",
  "Jesus Christ",
  "Love and Devotion",
  "Missions and Evangelism",
  "Praise & Worship",
  "Prayer",
  "Salvation",
  "Second Coming",
  "Thanksgiving",
  "The Church and Fellowship",
  "Warning",
  "Word of God",
  "Other",
] as const;
