/**
 * The IPC surface between the renderer and the main process.
 *
 * Every operation the desktop app can perform on the database is named here
 * with its argument and return types. `ipc.ts` in main dispatches through an
 * allowlist keyed by these names — the renderer can never send raw SQL.
 *
 * The shapes deliberately mirror the exported signatures of the web app's
 * `api.ts` modules, because the desktop `renderer/data/*` modules stand in for
 * those files at build time via a Vite alias and must be drop-in compatible.
 */
import type {
  Church,
  HymnTemplate,
  SectionType,
  Song,
  SongSection,
  SongWithSections,
  WorshipSet,
  WorshipSetItem,
} from "@/types/database";
import type {
  BibleBook,
  BibleChapterInfo,
  BibleSearchHit,
  BibleTranslation,
  BibleVerse,
} from "@/types/bible";

/** Mirrors `SongFormValues` in src/features/songs/api.ts. */
export interface SongFormValues {
  title: string;
  author: string;
  composer: string;
  category: string;
  key: string;
  tempo: string;
  description: string;
}

/** Mirrors `SectionFormValues` in src/lib/save-sections.ts. */
export interface SectionFormValues {
  id?: string;
  type: SectionType;
  title: string;
  lyrics: string;
  order_index: number;
}

export interface SongListItem extends Song {
  section_count: number;
}

export interface LibraryEntry extends HymnTemplate {
  section_count: number;
}

export interface WorshipSetListItem extends WorshipSet {
  item_count: number;
}

export interface WorshipSetItemWithTitle extends WorshipSetItem {
  song: Pick<Song, "id" | "title" | "author" | "category">;
}

export type SongPickerRow = Pick<Song, "id" | "title" | "author" | "category">;

export interface DashboardStats {
  totalSongs: number;
  totalHymns: number;
  totalSets: number;
  recentSongs: Song[];
}

/** The stand-in for a Supabase `profiles` row on a machine with no accounts. */
export interface LocalProfile {
  id: string;
  church_id: string;
  email: string;
  name: string | null;
  /**
   * The dashboard spotlight tour has run. Shared with the web app, which uses
   * the same flag on `profiles`.
   */
  onboarding_completed: boolean;
  /**
   * The first-run setup wizard has been through -- church name and the user's
   * name. Deliberately NOT the same flag as onboarding_completed: they run in
   * sequence, the wizard first and the tour once the dashboard is reachable,
   * and one flag could not tell the app which of the two it still owed.
   */
  setup_completed: boolean;
}

/** Facts about the running install, for the Settings page. */
export interface AppInfo {
  version: string;
  platform: string;
  /** Where the SQLite file lives, so the user can find or copy it. */
  databasePath: string;
}

export interface BackupResult {
  /** False when the user dismissed the file dialog. */
  completed: boolean;
  path: string | null;
}

/**
 * Op name -> { args, result }. Adding an entry here is the only step needed
 * before wiring it in `main/ipc.ts` and calling it from `renderer/data`.
 */
export interface Ops {
  "songs.list": { args: void; result: SongListItem[] };
  "songs.get": { args: { songId: string }; result: SongWithSections };
  "songs.create": {
    args: { values: SongFormValues; sourceTemplateId: string | null };
    result: Song;
  };
  "songs.update": { args: { songId: string; values: SongFormValues }; result: Song };
  "songs.delete": { args: { songId: string }; result: null };
  "songs.picker": { args: void; result: SongPickerRow[] };

  "sections.save": {
    args: {
      table: string;
      parentColumn: string;
      parentId: string;
      sections: SectionFormValues[];
      existingIds: string[];
    };
    result: SongSection[];
  };

  "sets.list": { args: void; result: WorshipSetListItem[] };
  "sets.get": {
    args: { setId: string };
    result: { set: WorshipSet; items: WorshipSetItemWithTitle[] };
  };
  "sets.create": { args: { name: string; description: string }; result: WorshipSet };
  "sets.update": {
    args: { setId: string; name: string; description: string };
    result: WorshipSet;
  };
  "sets.delete": { args: { setId: string }; result: null };
  "sets.saveItems": { args: { setId: string; songIds: string[] }; result: null };

  "library.list": { args: void; result: LibraryEntry[] };
  /** Returned as an array; the renderer rebuilds the Set the UI expects. */
  "library.addedTemplateIds": { args: void; result: string[] };
  "library.addToChurch": { args: { templateId: string }; result: Song };

  "church.get": { args: void; result: Church };
  "church.update": {
    args: { patch: { name?: string; accent_color?: string } };
    result: null;
  };

  "dashboard.stats": { args: void; result: DashboardStats };

  "profile.get": { args: void; result: LocalProfile };
  "profile.update": {
    args: {
      patch: { name?: string; onboarding_completed?: boolean; setup_completed?: boolean };
    };
    result: null;
  };

  /**
   * Scripture. Reads only -- there is deliberately no write op, which is what
   * stands in for the hosted app's "select policies and no others".
   */
  "bible.translations": { args: void; result: BibleTranslation[] };
  "bible.books": { args: void; result: BibleBook[] };
  "bible.chapterIndex": { args: { translationId: string }; result: BibleChapterInfo[] };
  "bible.passage": {
    args: {
      translationId: string;
      bookId: number;
      chapter: number;
      verseStart: number | null;
      verseEnd: number | null;
    };
    result: BibleVerse[];
  };
  "bible.search": {
    args: { translationId: string; query: string; limit: number };
    result: BibleSearchHit[];
  };

  "app.info": { args: void; result: AppInfo };

  "backup.export": { args: void; result: BackupResult };
  "backup.import": { args: void; result: BackupResult };
}

export type OpName = keyof Ops;
export type OpArgs<K extends OpName> = Ops[K]["args"];
export type OpResult<K extends OpName> = Ops[K]["result"];

/**
 * Error codes that must survive the IPC boundary. A thrown Error loses its
 * class when structured-cloned, so main returns a tagged failure and the
 * renderer re-throws the matching class — this is what keeps the
 * "already in your hymnal" branch in SongLibraryPage working.
 */
export type OpErrorCode = "ALREADY_IN_HYMNAL" | "UNKNOWN";

export type OpResponse<T> =
  | { ok: true; value: T }
  | { ok: false; code: OpErrorCode; message: string };

/** Channel names used outside the request/response `db:invoke` path. */
export const IPC = {
  invoke: "db:invoke",
  presentationSend: "presentation:send",
  presentationMessage: "presentation:message",
} as const;
