import { useCallback, useEffect, useState } from "react";
import type { SongListItem } from "@shared/contract";
import { invoke } from "./invoke";

export type { SongListItem };

/**
 * Desktop stand-in for src/features/songs/hooks/useSongs.ts.
 *
 * Same `{ songs, loading, error, reload }` shape. The section counts arrive
 * already folded into each row by the SQL in main, so there is no embedded
 * `song_sections: [{ count }]` array to flatten here.
 */
export function useSongs() {
  const [songs, setSongs] = useState<SongListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setSongs(await invoke("songs.list"));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't load your songs.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  return { songs, loading, error, reload };
}
