import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Plus, ListMusic, Pencil, Trash2, PlayCircle } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
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
  fetchWorshipSets,
  deleteWorshipSet,
  type WorshipSetListItem,
} from "@/features/worship-sets/api";

export function WorshipSetsListPage() {
  const navigate = useNavigate();
  const [sets, setSets] = useState<WorshipSetListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  async function reload() {
    setLoading(true);
    try {
      setSets(await fetchWorshipSets());
    } catch (err) {
      console.error(err);
      toast.error("Failed to load worship sets.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    reload();
  }, []);

  async function handleDelete() {
    if (!pendingDeleteId) return;
    try {
      await deleteWorshipSet(pendingDeleteId);
      toast.success("Worship set deleted.");
      reload();
    } catch (err) {
      console.error(err);
      toast.error("Failed to delete worship set.");
    } finally {
      setPendingDeleteId(null);
    }
  }

  return (
    <AppShell>
      <div className="mx-auto max-w-5xl">
        <div className="mb-6 flex items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold text-foreground">Worship Sets</h1>
            <p className="text-sm text-muted-foreground">
              Group songs into a service order, ready to present.
            </p>
          </div>
          <Button onClick={() => navigate("/sets/new")}>
            <Plus className="h-4 w-4" />
            Create Worship Set
          </Button>
        </div>

        {loading ? (
          <div className="grid gap-4 sm:grid-cols-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-32 w-full" />
            ))}
          </div>
        ) : sets.length === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-border bg-muted/30 px-4 py-16 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
              <ListMusic className="h-6 w-6" />
            </div>
            <div>
              <p className="font-medium text-foreground">No worship sets yet.</p>
              <p className="text-sm text-muted-foreground">
                Create a set to plan Sunday's service order.
              </p>
            </div>
            <Button onClick={() => navigate("/sets/new")}>
              <Plus className="h-4 w-4" />
              Create Worship Set
            </Button>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {sets.map((set) => (
              <Card key={set.id} className="flex flex-col">
                <CardHeader>
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-base">{set.name}</CardTitle>
                    <Badge variant="secondary">{set.item_count} songs</Badge>
                  </div>
                  {set.description && <CardDescription>{set.description}</CardDescription>}
                </CardHeader>
                <CardContent className="mt-auto flex items-center justify-between pt-0">
                  <span className="text-xs text-muted-foreground">
                    Updated {formatDistanceToNow(new Date(set.updated_at), { addSuffix: true })}
                  </span>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      title="Present"
                      onClick={() =>
                        navigate(`/presentation/${crypto.randomUUID()}?type=set&id=${set.id}`)
                      }
                    >
                      <PlayCircle className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      title="Edit"
                      onClick={() => navigate(`/sets/${set.id}`)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive hover:text-destructive"
                      title="Delete"
                      onClick={() => setPendingDeleteId(set.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      <AlertDialog open={!!pendingDeleteId} onOpenChange={(v) => !v && setPendingDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this worship set?</AlertDialogTitle>
            <AlertDialogDescription>
              The songs themselves won't be deleted, only this set's order. This cannot be undone.
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
