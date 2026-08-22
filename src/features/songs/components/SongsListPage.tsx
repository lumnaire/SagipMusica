import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import {
  Plus,
  Search,
  Music2,
  Eye,
  Pencil,
  Trash2,
  PlayCircle,
  ChevronLeft,
  ChevronRight,
  Library,
} from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useSongs } from "@/features/songs/hooks/useSongs";
import { deleteSong } from "@/features/songs/api";
import { SONG_CATEGORIES } from "@/types/database";
import { useAuthStore } from "@/stores/auth-store";
import { formatDistanceToNow } from "date-fns";

const PAGE_SIZE = 15;

type SortOption = "title-asc" | "title-desc" | "recent";

const SORT_LABELS: Record<SortOption, string> = {
  "title-asc": "Title A–Z",
  "title-desc": "Title Z–A",
  recent: "Recently updated",
};

export function SongsListPage() {
  const { songs, loading, reload } = useSongs();
  const navigate = useNavigate();
  const isAdmin = useAuthStore((s) => s.profile?.role === "admin");
  const [searchParams, setSearchParams] = useSearchParams();
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<string>(searchParams.get("category") ?? "all");
  const [sort, setSort] = useState<SortOption>("title-asc");
  const [page, setPage] = useState(1);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const showCategories = searchParams.get("view") === "categories";

  const categoryCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const s of songs) {
      if (!s.category) continue;
      counts.set(s.category, (counts.get(s.category) ?? 0) + 1);
    }
    return counts;
  }, [songs]);

  function viewCategory(cat: string) {
    setCategory(cat);
    setSearchParams({ category: cat });
  }

  const filtered = useMemo(() => {
    const matches = songs.filter((s) => {
      const matchesSearch =
        !search ||
        s.title.toLowerCase().includes(search.toLowerCase()) ||
        (s.author ?? "").toLowerCase().includes(search.toLowerCase());
      const matchesCategory = category === "all" || s.category === category;
      return matchesSearch && matchesCategory;
    });

    const sorted = [...matches];
    switch (sort) {
      case "title-asc":
        // localeCompare so accented titles file where a reader expects.
        sorted.sort((a, b) => a.title.localeCompare(b.title));
        break;
      case "title-desc":
        sorted.sort((a, b) => b.title.localeCompare(a.title));
        break;
      case "recent":
        sorted.sort(
          (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime(),
        );
        break;
    }
    return sorted;
  }, [songs, search, category, sort]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const visible = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  // Any change to the result set should put the reader back at the first page,
  // otherwise a narrowed search can strand them on an empty one.
  useEffect(() => {
    setPage(1);
  }, [search, category, sort]);

  async function handleDelete() {
    if (!pendingDeleteId) return;
    try {
      await deleteSong(pendingDeleteId);
      toast.success("Song deleted.");
      reload();
    } catch (err) {
      console.error(err);
      toast.error("Failed to delete song.");
    } finally {
      setPendingDeleteId(null);
    }
  }

  return (
    <AppShell>
      <div className="mx-auto max-w-6xl">
        <div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <h1 className="font-display text-2xl text-foreground">Songs</h1>
            <p className="text-sm text-muted-foreground">Manage your church's hymnal.</p>
          </div>
          {isAdmin && (
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button
                variant="outline"
                className="w-full sm:w-auto"
                onClick={() => navigate("/songs/library")}
              >
                <Library className="h-4 w-4" />
                Browse library
              </Button>
              <Button className="w-full sm:w-auto" onClick={() => navigate("/songs/new")}>
                <Plus className="h-4 w-4" />
                Add Song
              </Button>
            </div>
          )}
        </div>

        {showCategories && (
          <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {SONG_CATEGORIES.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => viewCategory(c)}
                className="flex flex-col items-start gap-1 rounded-lg border border-border bg-card p-4 text-left shadow-sm transition-colors hover:border-primary/40 hover:bg-muted/40"
              >
                <span className="text-sm font-medium text-foreground">{c}</span>
                <span className="text-xs text-muted-foreground">
                  {categoryCounts.get(c) ?? 0} song{categoryCounts.get(c) === 1 ? "" : "s"}
                </span>
              </button>
            ))}
          </div>
        )}

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
          <Select
            value={category}
            onValueChange={(v) => {
              setCategory(v);
              setSearchParams(v === "all" ? {} : { category: v });
            }}
          >
            <SelectTrigger className="sm:w-56">
              <SelectValue placeholder="All categories" />
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
          <Select value={sort} onValueChange={(v) => setSort(v as SortOption)}>
            <SelectTrigger className="sm:w-48 lg:w-52" aria-label="Sort songs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(SORT_LABELS) as SortOption[]).map((option) => (
                <SelectItem key={option} value={option}>
                  {SORT_LABELS[option]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-14 w-full" />
            ))}
          </div>
        ) : songs.length === 0 ? (
          <EmptyState isAdmin={isAdmin} onAdd={() => navigate("/songs/new")} />
        ) : filtered.length === 0 ? (
          <p className="rounded-md border border-dashed border-border bg-muted/30 px-4 py-10 text-center text-sm text-muted-foreground">
            No songs match your search.
          </p>
        ) : (
          <div className="overflow-hidden rounded-lg border border-border bg-card">
            <Table>
              <TableHeader>
                {/* Secondary columns drop away as the screen narrows, so a
                    phone shows the song and its actions instead of a table
                    that has to be scrolled sideways to be useful. */}
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead className="hidden md:table-cell">Author</TableHead>
                  <TableHead className="hidden lg:table-cell">Category</TableHead>
                  <TableHead className="hidden xl:table-cell">Key</TableHead>
                  <TableHead className="hidden xl:table-cell">Sections</TableHead>
                  <TableHead className="hidden lg:table-cell">Updated</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visible.map((song) => (
                  <TableRow key={song.id}>
                    <TableCell className="font-medium text-foreground">
                      <div className="flex items-center gap-2">
                        <Music2 className="h-4 w-4 shrink-0 text-muted-foreground" />
                        <div className="min-w-0">
                          <span className="block truncate">{song.title}</span>
                          {/* Author folds under the title once its own
                              column is hidden, so it isn't simply lost. */}
                          {song.author && (
                            <span className="block truncate text-xs font-normal text-muted-foreground md:hidden">
                              {song.author}
                            </span>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="hidden text-muted-foreground md:table-cell">
                      {song.author || "—"}
                    </TableCell>
                    <TableCell className="hidden lg:table-cell">
                      {song.category ? <Badge variant="secondary">{song.category}</Badge> : "—"}
                    </TableCell>
                    <TableCell className="hidden text-muted-foreground xl:table-cell">
                      {song.key || "—"}
                    </TableCell>
                    <TableCell className="hidden text-muted-foreground xl:table-cell">
                      {song.section_count}
                    </TableCell>
                    <TableCell className="hidden whitespace-nowrap text-muted-foreground lg:table-cell">
                      {formatDistanceToNow(new Date(song.updated_at), { addSuffix: true })}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          title="Preview"
                          onClick={() => navigate(`/songs/${song.id}`)}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          title="Present"
                          onClick={() =>
                            navigate(`/presentation/${crypto.randomUUID()}?type=song&id=${song.id}`)
                          }
                        >
                          <PlayCircle className="h-4 w-4" />
                        </Button>
                        {isAdmin && (
                          <>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              title="Edit"
                              onClick={() => navigate(`/songs/${song.id}/edit`)}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-destructive hover:text-destructive"
                              title="Delete"
                              onClick={() => setPendingDeleteId(song.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        {!loading && filtered.length > 0 && (
          <div className="mt-4 flex flex-col items-center justify-between gap-3 sm:flex-row">
            <p className="text-sm text-muted-foreground" aria-live="polite">
              Showing {(currentPage - 1) * PAGE_SIZE + 1}–
              {Math.min(currentPage * PAGE_SIZE, filtered.length)} of {filtered.length} song
              {filtered.length === 1 ? "" : "s"}
            </p>

            {pageCount > 1 && (
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={currentPage === 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  <ChevronLeft className="h-4 w-4" />
                  Previous
                </Button>
                <span className="px-1 text-sm text-muted-foreground">
                  Page {currentPage} of {pageCount}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={currentPage === pageCount}
                  onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
                >
                  Next
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>
        )}
      </div>

      <AlertDialog open={!!pendingDeleteId} onOpenChange={(v) => !v && setPendingDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this song?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove the song and its sections. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleDelete}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppShell>
  );
}

function EmptyState({ isAdmin, onAdd }: { isAdmin: boolean; onAdd: () => void }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-border bg-muted/30 px-4 py-16 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
        <Music2 className="h-6 w-6" />
      </div>
      <div>
        <p className="font-medium text-foreground">No songs yet.</p>
        <p className="text-sm text-muted-foreground">
          {isAdmin
            ? "Build your church hymnal by adding your first song."
            : "Ask an admin to add songs to the hymnal."}
        </p>
      </div>
      {isAdmin && (
        <Button onClick={onAdd}>
          <Plus className="h-4 w-4" />
          Add Song
        </Button>
      )}
    </div>
  );
}
