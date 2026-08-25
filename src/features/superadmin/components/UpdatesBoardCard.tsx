import { useCallback, useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Eye, EyeOff, Plus, Rocket, Trash2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import {
  createUpdate,
  deleteUpdate,
  fetchAllUpdates,
  setUpdatePublished,
} from "@/features/updates/api";
import type { PlatformUpdate } from "@/types/database";

/** Mirrors the check constraints in migration 0016, so the form refuses what
    the database would refuse anyway -- with a better error than a 400. */
const TITLE_MAX = 120;
const DETAIL_MAX = 600;

/**
 * The "what's coming" board, as edited by the superadmin.
 *
 * Everything here writes straight to platform_updates; RLS is the gate, not
 * this component, so a non-superadmin who reached this code would get errors
 * from the database rather than a working editor.
 *
 * Drafts exist because this list is public the moment it is saved. Unpublish
 * is offered alongside delete so a line can be pulled off the download page
 * without losing what it said.
 */
export function UpdatesBoardCard() {
  const [updates, setUpdates] = useState<PlatformUpdate[] | null>(null);
  const [title, setTitle] = useState("");
  const [detail, setDetail] = useState("");
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<PlatformUpdate | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    try {
      setUpdates(await fetchAllUpdates());
    } catch (err) {
      console.error(err);
      toast.error(err instanceof Error ? err.message : "Couldn't load the updates board.");
      setUpdates([]);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    const trimmedTitle = title.trim();
    const trimmedDetail = detail.trim();
    if (trimmedTitle.length < 2) return;

    setSaving(true);
    try {
      await createUpdate(trimmedTitle, trimmedDetail || null);
      setTitle("");
      setDetail("");
      toast.success("Added to the board.");
      await load();
    } catch (err) {
      console.error(err);
      toast.error(err instanceof Error ? err.message : "Couldn't add that update.");
    } finally {
      setSaving(false);
    }
  }

  async function handleTogglePublished(update: PlatformUpdate) {
    setBusyId(update.id);
    try {
      await setUpdatePublished(update.id, !update.is_published);
      toast.success(
        update.is_published
          ? "Hidden from the download page."
          : "Now showing on the download page.",
      );
      await load();
    } catch (err) {
      console.error(err);
      toast.error(err instanceof Error ? err.message : "Couldn't change that update.");
    } finally {
      setBusyId(null);
    }
  }

  async function handleDelete() {
    if (!pendingDelete) return;
    setDeleting(true);
    try {
      await deleteUpdate(pendingDelete.id);
      toast.success("Removed from the board.");
      setPendingDelete(null);
      await load();
    } catch (err) {
      console.error(err);
      toast.error(err instanceof Error ? err.message : "Couldn't delete that update.");
    } finally {
      setDeleting(false);
    }
  }

  const publishedCount = updates?.filter((u) => u.is_published).length ?? 0;

  return (
    <section className="mt-10">
      <div className="mb-4">
        <h2 className="font-display text-xl text-foreground">Upcoming updates</h2>
        <p className="text-sm text-muted-foreground">
          The board on the{" "}
          <a
            href="/download"
            className="underline underline-offset-4 hover:text-foreground"
          >
            download page
          </a>
          . Published entries are public; anything hidden is only visible here.
        </p>
      </div>

      <div className="rounded-lg border border-border bg-card p-4 sm:p-5">
        <form className="flex flex-col gap-3" onSubmit={handleCreate}>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="update-title">Title</Label>
            <Input
              id="update-title"
              value={title}
              maxLength={TITLE_MAX}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Built-in Bible for verse presentation"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="update-detail">
              Detail <span className="text-muted-foreground">(optional)</span>
            </Label>
            <Textarea
              id="update-detail"
              value={detail}
              maxLength={DETAIL_MAX}
              rows={3}
              onChange={(e) => setDetail(e.target.value)}
              placeholder="A sentence or two on what it does for a worship team."
            />
            <p className="text-right text-xs text-muted-foreground">
              {detail.length}/{DETAIL_MAX}
            </p>
          </div>

          <div className="flex justify-end">
            <Button type="submit" disabled={saving || title.trim().length < 2}>
              <Plus className="h-4 w-4" />
              {saving ? "Adding..." : "Add to board"}
            </Button>
          </div>
        </form>

        <div className="my-5 h-px bg-border" aria-hidden="true" />

        {updates === null ? (
          <div className="space-y-2">
            {Array.from({ length: 2 }).map((_, i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        ) : updates.length === 0 ? (
          <p className="rounded-md border border-dashed border-border bg-muted/30 px-4 py-8 text-center text-sm text-muted-foreground">
            The board is empty. Visitors to the download page are being asked
            for suggestions instead.
          </p>
        ) : (
          <ul className="space-y-2">
            {updates.map((update) => (
              <li
                key={update.id}
                className="flex flex-col gap-3 rounded-md border border-border bg-background p-3 sm:flex-row sm:items-start sm:justify-between"
              >
                <div className="flex min-w-0 gap-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-accent/15 text-accent-foreground">
                    <Rocket className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium text-foreground">{update.title}</span>
                      {!update.is_published && (
                        <Badge variant="outline" className="text-[10px]">
                          Hidden
                        </Badge>
                      )}
                    </div>
                    {update.detail && (
                      <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                        {update.detail}
                      </p>
                    )}
                    <p className="mt-1 text-xs text-muted-foreground">
                      Added{" "}
                      {formatDistanceToNow(new Date(update.created_at), {
                        addSuffix: true,
                      })}
                    </p>
                  </div>
                </div>

                <div className="flex shrink-0 items-center justify-end gap-1">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 whitespace-nowrap"
                    disabled={busyId === update.id}
                    onClick={() => void handleTogglePublished(update)}
                  >
                    {update.is_published ? (
                      <>
                        <EyeOff className="h-4 w-4" />
                        Hide
                      </>
                    ) : (
                      <>
                        <Eye className="h-4 w-4" />
                        Publish
                      </>
                    )}
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive hover:text-destructive"
                    title="Delete this update"
                    onClick={() => setPendingDelete(update)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}

        {updates !== null && updates.length > 0 && (
          <p className="mt-3 text-xs text-muted-foreground">
            {publishedCount} of {updates.length} showing on the download page.
          </p>
        )}
      </div>

      <AlertDialog
        open={!!pendingDelete}
        onOpenChange={(open) => !open && !deleting && setPendingDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this update?</AlertDialogTitle>
            <AlertDialogDescription>
              <strong>{pendingDelete?.title}</strong> will be removed from the board for
              good. To take it off the download page without losing it, use Hide instead.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                void handleDelete();
              }}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? "Deleting..." : "Delete update"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
