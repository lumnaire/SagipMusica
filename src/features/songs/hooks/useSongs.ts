import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import type { Song } from "@/types/database";

export interface SongListItem extends Song {
  section_count: number;
}

export function useSongs() {
  const [songs, setSongs] = useState<SongListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    const { data, error } = await supabase
      .from("songs")
      .select("*, song_sections(count)")
      .order("updated_at", { ascending: false });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    type Row = Song & { song_sections: { count: number }[] };
    const rows = (data ?? []) as unknown as Row[];
    setSongs(
      rows.map((row) => ({
        ...row,
        section_count: row.song_sections?.[0]?.count ?? 0,
      })),
    );
    setLoading(false);
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  return { songs, loading, error, reload };
}
