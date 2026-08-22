import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
  Plus,
  Search,
  Music2,
  Pencil,
  Trash2,
  Send,
  EyeOff,
  RefreshCw,
  Sparkles,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
import {
  deleteTemplate,
  listTemplates,
  setTemplateStatus,
  type TemplateListItem,
} from "@/features/encoder/api";
import { PaginationFooter } from "@/components/ui/pagination";
import { usePagination } from "@/hooks/usePagination";
import { SONG_CATEGORIES } from "@/types/database";
import { EncoderShell } from "./EncoderShell";

type StatusFilter = "all" | "published" | "draft";

const PAGE_SIZE = 15;

type MissingField = "lyrics" | "author" | "composer" | "key" | "tempo" | "category";

/**
 * The encoder's work queues. The FBC import (0013) could only carry what its
 * source JSON held — title, author, category and lyrics — so composer, key and
 * tempo arrived empty on all 399 hymns. Filling those gaps is the day-to-day
 * job, and these make each gap one click away.
 *
 * `!t.field` deliberately catches both null and "": a song saved with the field
 * cleared is just as unfinished as one that never had it.
 */
const MISSING_FILTERS: {
  id: MissingField;
  label: string;
  isMissing: (t: TemplateListItem) => boolean;
}[] = [
  { id: "lyrics", label: "No lyrics", isMissing: (t) => t.section_count === 0 },
  { id: "author", label: "No author", isMissing: (t) => !t.author },
  { id: "composer", label: "No composer", isMissing: (t) => !t.composer },
  { id: "key", label: "No key", isMissing: (t) => !t.key },
  { id: "tempo", label: "No tempo", isMissing: (t) => !t.tempo },
  { id: "category", label: "No category", isMissing: (t) => !t.category },
];

export function EncoderPage() {
  const navigate = useNavigate();
  const [templates, setTemplates] = useState<TemplateListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [category, setCategory] = useState("all");
  const [missing, setMissing] = useState<MissingField[]>([]);
  const [pendingDelete, setPendingDelete] = useState<TemplateListItem | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setTemplates(await listTemplates());
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

  async function handleToggleStatus(template: TemplateListItem) {
    const next = template.status === "published" ? "draft" : "published";
    // metadata_only songs ship with no sections at all, by design.
    if (
      next === "published" &&
      template.section_count === 0 &&
      template.copyright_status !== "metadata_only"
    ) {
      toast.error("Add at least one section before publishing.");
      return;
    }
    setBusyId(template.id);
    try {
      await setTemplateStatus(template.id, next);
      toast.success(
        next === "published"
          ? `"${template.title}" is now in the library.`
          : `"${template.title}" is hidden from the library.`,
      );
      await load();
    } catch (err) {
      console.error(err);
      toast.error("Couldn't change that song's status.");
    } finally {
      setBusyId(null);
    }
  }

  async function handleDelete() {
    if (!pendingDelete) return;
    setBusyId(pendingDelete.id);
    try {
      await deleteTemplate(pendingDelete.id);
      toast.success(`"${pendingDelete.title}" removed from the library.`);
      setPendingDelete(null);
      await load();
    } catch (err) {
      console.error(err);
      toast.error("Couldn't delete that song.");
    } finally {
      setBusyId(null);
    }
  }

  // Everything except the missing-chips. Kept separate so the chip counts can
  // be faceted: each number says how many rows that chip would surface *here*,
  // under the category and search already in force, rather than a fixed total
  // that ignores the filters sitting next to it.
  const base = useMemo(() => {
    const q = search.toLowerCase();
    return templates.filter((t) => {
      const matchesSearch =
        !q ||
        t.title.toLowerCase().includes(q) ||
        (t.author ?? "").toLowerCase().includes(q);
      const matchesStatus = status === "all" || t.status === status;
      const matchesCategory = category === "all" || t.category === category;
      return matchesSearch && matchesStatus && matchesCategory;
    });
  }, [templates, search, status, category]);

  const counts = useMemo(() => {
    const out = {} as Record<MissingField, number>;
    for (const f of MISSING_FILTERS) out[f.id] = base.filter(f.isMissing).length;
    return out;
  }, [base]);

  // Union, not intersection: two chips on means "missing either", so the list
  // reads as a triage queue rather than narrowing to the songs unlucky enough
  // to be missing both.
  const filtered = useMemo(() => {
    if (missing.length === 0) return base;
    const active = MISSING_FILTERS.filter((f) => missing.includes(f.id));
    return base.filter((t) => active.some((f) => f.isMissing(t)));
  }, [base, missing]);

  const { visible, page, pageCount, setPage } = usePagination(
    filtered,
    PAGE_SIZE,
    `${search}|${status}|${category}|${missing.join(",")}`,
  );

  function toggleMissing(id: MissingField) {
    setMissing((prev) =>
      prev.includes(id) ? prev.filter((f) => f !== id) : [...prev, id],
    );
  }

  const publishedCount = templates.filter((t) => t.status === "published").length;
  const draftCount = templates.length - publishedCount;

  return (
    <EncoderShell
      actions={
        <>
          <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
            <RefreshCw className={loading ? "h-4 w-4 animate-spin" : "h-4 w-4"} />
            Refresh
          </Button>
          <Button size="sm" onClick={() => navigate("/encoder/songs/new")}>
            <Plus className="h-4 w-4" />
            New Song
          </Button>
        </>
      }
    >
      <div className="mb-6">
        <h2 className="font-display text-2xl text-foreground">Shared library</h2>
        <p className="text-sm text-muted-foreground">
          {loading
            ? "Loading..."
            : `${publishedCount} published, ${draftCount} draft${draftCount === 1 ? "" : "s"}. Church admins can add any published song to their own hymnal.`}
        </p>
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
        <Select value={status} onValueChange={(v) => setStatus(v as StatusFilter)}>
          <SelectTrigger className="sm:w-44" aria-label="Filter by status">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="published">Published</SelectItem>
            <SelectItem value="draft">Drafts</SelectItem>
          </SelectContent>
        </Select>
        <Select value={category} onValueChange={setCategory}>
          <SelectTrigger className="sm:w-48" aria-label="Filter by category">
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

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <span className="text-sm text-muted-foreground">Needs work:</span>
        {MISSING_FILTERS.map((f) => {
          const active = missing.includes(f.id);
          return (
            <Button
              key={f.id}
              type="button"
              variant={active ? "default" : "outline"}
              size="sm"
              aria-pressed={active}
              onClick={() => toggleMissing(f.id)}
            >
              {f.label}
              <span className="ml-1 tabular-nums opacity-70">{counts[f.id]}</span>
            </Button>
          );
        })}
        {missing.length > 0 && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setMissing([])}
          >
            Clear
          </Button>
        )}
      </div>

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full" />
          ))}
        </div>
      ) : templates.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-border bg-muted/30 px-4 py-16 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Music2 className="h-6 w-6" />
          </div>
          <div>
            <p className="font-medium text-foreground">The library is empty.</p>
            <p className="text-sm text-muted-foreground">
              Add a song and publish it to make it available to every church.
            </p>
          </div>
          <Button onClick={() => navigate("/encoder/songs/new")}>
            <Plus className="h-4 w-4" />
            New Song
          </Button>
        </div>
      ) : filtered.length === 0 ? (
        <p className="rounded-md border border-dashed border-border bg-muted/30 px-4 py-10 text-center text-sm text-muted-foreground">
          No songs match your filters.
        </p>
      ) : (
        <div className="overflow-hidden rounded-lg border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead className="hidden md:table-cell">Author</TableHead>
                <TableHead className="hidden lg:table-cell">Category</TableHead>
                <TableHead className="hidden xl:table-cell">Sections</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="hidden lg:table-cell">Updated</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visible.map((t) => {
                const busy = busyId === t.id;
                const published = t.status === "published";
                return (
                  <TableRow key={t.id}>
                    <TableCell className="font-medium text-foreground">
                      <div className="flex items-center gap-2">
                        <Music2 className="h-4 w-4 shrink-0 text-muted-foreground" />
                        <div className="min-w-0">
                          <span className="block truncate">{t.title}</span>
                          {t.author && (
                            <span className="block truncate text-xs font-normal text-muted-foreground md:hidden">
                              {t.author}
                            </span>
                          )}
                          {t.copyright_status !== "public_domain" && (
                            <Badge variant="outline" className="mt-1 text-[10px]">
                              {t.copyright_status === "metadata_only"
                                ? "No lyrics"
                                : "Licensed"}
                            </Badge>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="hidden text-muted-foreground md:table-cell">
                      {t.author || "—"}
                    </TableCell>
                    <TableCell className="hidden lg:table-cell">
                      {t.category ? <Badge variant="secondary">{t.category}</Badge> : "—"}
                    </TableCell>
                    <TableCell className="hidden text-muted-foreground xl:table-cell">
                      {t.section_count}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Badge variant={published ? "default" : "outline"}>
                          {published ? "Published" : "Draft"}
                        </Badge>
                        {t.is_starter && (
                          <span title="Given to every new church at signup">
                            <Sparkles className="h-3.5 w-3.5 text-primary" />
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="hidden whitespace-nowrap text-muted-foreground lg:table-cell">
                      {formatDistanceToNow(new Date(t.updated_at), { addSuffix: true })}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          title={published ? "Unpublish" : "Publish to library"}
                          disabled={busy}
                          onClick={() => void handleToggleStatus(t)}
                        >
                          {published ? (
                            <EyeOff className="h-4 w-4" />
                          ) : (
                            <Send className="h-4 w-4" />
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          title="Edit"
                          onClick={() => navigate(`/encoder/songs/${t.id}`)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive"
                          title="Delete"
                          disabled={busy}
                          onClick={() => setPendingDelete(t)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {!loading && filtered.length > 0 && (
        <PaginationFooter
          page={page}
          pageCount={pageCount}
          pageSize={PAGE_SIZE}
          total={filtered.length}
          onPageChange={setPage}
        />
      )}

      <AlertDialog
        open={!!pendingDelete}
        onOpenChange={(open) => !open && setPendingDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this library song?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes <strong>{pendingDelete?.title}</strong> from the shared library so no
              church can add it again. Churches that already added it keep their copy — those are
              theirs and are never touched.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={(e) => {
                e.preventDefault();
                void handleDelete();
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </EncoderShell>
  );
}
