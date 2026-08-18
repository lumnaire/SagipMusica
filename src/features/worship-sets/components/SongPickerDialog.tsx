import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Search, Plus } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { fetchAllSongsForPicker } from "@/features/worship-sets/api";
import type { Song } from "@/types/database";

type PickerSong = Pick<Song, "id" | "title" | "author" | "category">;

interface SongPickerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  excludeIds: string[];
  onAdd: (song: PickerSong) => void;
}

export function SongPickerDialog({ open, onOpenChange, excludeIds, onAdd }: SongPickerDialogProps) {
  const [songs, setSongs] = useState<PickerSong[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const data = await fetchAllSongsForPicker();
        if (!cancelled) setSongs(data);
      } catch (err) {
        console.error(err);
        toast.error("Failed to load songs.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open]);

  const filtered = songs.filter(
    (s) =>
      !excludeIds.includes(s.id) &&
      (!search || s.title.toLowerCase().includes(search.toLowerCase())),
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Add Songs</DialogTitle>
          <DialogDescription>Search your hymnal and add songs to this set.</DialogDescription>
        </DialogHeader>

        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search songs..."
            className="pl-9"
          />
        </div>

        <div className="max-h-80 overflow-y-auto">
          {loading ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Loading songs...</p>
          ) : filtered.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">No songs found.</p>
          ) : (
            <ul className="divide-y divide-border">
              {filtered.map((song) => (
                <li key={song.id} className="flex items-center justify-between gap-2 py-2">
                  <div>
                    <p className="text-sm font-medium text-foreground">{song.title}</p>
                    <p className="text-xs text-muted-foreground">{song.author || "Unknown author"}</p>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => onAdd(song)}>
                    <Plus className="h-3.5 w-3.5" />
                    Add
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
