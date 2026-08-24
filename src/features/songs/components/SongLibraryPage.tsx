import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { ArrowLeft, Check, Library, Plus, Search, Music2 } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  AlreadyInHymnalError,
  addLibrarySongToChurch,
  fetchAddedTemplateIds,
  fetchHymnLibrary,
  type LibraryEntry,
} from "@/features/songs/api";
import { SONG_CATEGORIES } from "@/types/database";

export function SongLibraryPage() {
  const navigate = useNavigate();
  const [entries, setEntries] = useState<LibraryEntry[]>([]);
  const [added, setAdded] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [addingId, setAddingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [library, addedIds] = await Promise.all([
        fetchHymnLibrary(),
        fetchAddedTemplateIds(),
      ]);
      setEntries(library);
      setAdded(addedIds);
    } catch (err) {
      console.error(err);
      toast.error("Couldn't load the library.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleAdd(entry: LibraryEntry) {
    setAddingId(entry.id);
    try {
      await addLibrarySongToChurch(entry.id);
      setAdded((prev) => new Set(prev).add(entry.id));
      toast.success(`"${entry.title}" added to your hymnal.`);
    } catch (err) {
      console.error(err);
      if (err instanceof AlreadyInHymnalError) {
        setAdded((prev) => new Set(prev).add(entry.id));
        toast.info(err.message);
      } else {
        toast.error("Couldn't add that song.");
      }
    } finally {
      setAddingId(null);
    }
  }

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return entries.filter((e) => {
      const matchesSearch =
        !q ||
        e.title.toLowerCase().includes(q) ||
        (e.author ?? "").toLowerCase().includes(q);
      const matchesCategory = category === "all" || e.category === category;
      return matchesSearch && matchesCategory;
    });
  }, [entries, search, category]);

  return (
    <AppShell>
      <div className="mx-auto max-w-6xl">
        <div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate("/songs")}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="font-display text-2xl text-foreground">Song Library</h1>
              <p className="text-sm text-muted-foreground">
                Ready-made songs you can add to your hymnal. Your copy is yours to edit.
              </p>
            </div>
          </div>
        </div>

        <div className="mb-4 flex flex-col gap-3 sm:flex-row">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by title or author..."
              className="pl-9"
            />
          </div>
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger className="sm:w-56" aria-label="Filter by category">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All categories</SelectItem>
              {SONG_CATEGORIES.map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {loading ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-40 w-full" />
            ))}
          </div>
        ) : entries.length === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-border bg-muted/30 px-4 py-16 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Library className="h-6 w-6" />
            </div>
            <div>
              <p className="font-medium text-foreground">The library is empty.</p>
              <p className="text-sm text-muted-foreground">
                Ready-made songs will appear here as they're published.
              </p>
            </div>
          </div>
        ) : filtered.length === 0 ? (
          <p className="rounded-md border border-dashed border-border bg-muted/30 px-4 py-10 text-center text-sm text-muted-foreground">
            No songs match your search.
          </p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((entry) => {
              const isAdded = added.has(entry.id);
              const isAdding = addingId === entry.id;
              return (
                <Card key={entry.id} data-testid="library-song" className="flex flex-col">
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-start gap-2 text-base">
                      <Music2 className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                      <span className="min-w-0 wrap-break-word">{entry.title}</span>
                    </CardTitle>
                    {entry.author && (
                      <p className="text-sm text-muted-foreground">{entry.author}</p>
                    )}
                  </CardHeader>
                  <CardContent className="flex flex-1 flex-col justify-between gap-3">
                    <div className="flex flex-wrap gap-1.5">
                      {entry.category && <Badge variant="secondary">{entry.category}</Badge>}
                      {entry.key && <Badge variant="outline">Key of {entry.key}</Badge>}
                      <Badge variant="outline">
                        {entry.section_count} section{entry.section_count === 1 ? "" : "s"}
                      </Badge>
                      {entry.copyright_status === "metadata_only" && (
                        <Badge variant="outline" className="text-[10px]">
                          No lyrics — add under your CCLI licence
                        </Badge>
                      )}
                    </div>
                    <Button
                      variant={isAdded ? "outline" : "default"}
                      disabled={isAdded || isAdding}
                      onClick={() => void handleAdd(entry)}
                    >
                      {isAdded ? (
                        <>
                          <Check className="h-4 w-4" />
                          Added
                        </>
                      ) : (
                        <>
                          <Plus className="h-4 w-4" />
                          {isAdding ? "Adding..." : "Add to my hymnal"}
                        </>
                      )}
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {!loading && filtered.length > 0 && (
          <p className="mt-4 text-sm text-muted-foreground">
            Showing {filtered.length} of {entries.length} song
            {entries.length === 1 ? "" : "s"}
          </p>
        )}
      </div>
    </AppShell>
  );
}
