import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { ArrowLeft, Plus, Save, PlayCircle } from "lucide-react";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SongPickerDialog } from "./SongPickerDialog";
import { SortableSongRow } from "./SortableSongRow";
import {
  createWorshipSet,
  updateWorshipSet,
  fetchWorshipSetDetail,
  saveWorshipSetItems,
} from "@/features/worship-sets/api";
import type { Song } from "@/types/database";

type PickerSong = Pick<Song, "id" | "title" | "author" | "category">;

export function WorshipSetEditorPage() {
  const { id } = useParams<{ id: string }>();
  const isNew = !id;
  const navigate = useNavigate();

  const [setId, setSetId] = useState<string | null>(id ?? null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [items, setItems] = useState<PickerSong[]>([]);
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  useEffect(() => {
    if (isNew) return;
    let cancelled = false;
    (async () => {
      try {
        const { set, items } = await fetchWorshipSetDetail(id!);
        if (cancelled) return;
        setName(set.name);
        setDescription(set.description ?? "");
        setItems(items.map((i) => i.song));
      } catch (err) {
        console.error(err);
        toast.error("Failed to load worship set.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id, isNew]);

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setItems((prev) => {
      const oldIndex = prev.findIndex((s) => s.id === active.id);
      const newIndex = prev.findIndex((s) => s.id === over.id);
      return arrayMove(prev, oldIndex, newIndex);
    });
  }

  async function handleSave() {
    if (!name.trim()) {
      toast.error("Worship set name is required.");
      return;
    }
    setSaving(true);
    try {
      let currentSetId = setId;
      if (!currentSetId) {
        const created = await createWorshipSet(name, description);
        currentSetId = created.id;
        setSetId(created.id);
      } else {
        await updateWorshipSet(currentSetId, name, description);
      }
      await saveWorshipSetItems(currentSetId, items.map((i) => i.id));
      toast.success(isNew ? "Worship set created." : "Worship set saved.");
      if (isNew) {
        navigate(`/sets/${currentSetId}`, { replace: true });
      }
    } catch (err) {
      console.error(err);
      toast.error("Failed to save worship set.");
    } finally {
      setSaving(false);
    }
  }

  function startPresentation() {
    if (!setId) {
      toast.error("Save the worship set first.");
      return;
    }
    navigate(`/presentation/${crypto.randomUUID()}?type=set&id=${setId}`);
  }

  if (loading) {
    return (
      <AppShell>
        <p className="text-sm text-muted-foreground">Loading worship set...</p>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="mx-auto max-w-3xl">
        <div className="mb-6 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate("/sets")}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="text-xl font-semibold text-foreground">
                {isNew ? "Create Worship Set" : "Edit Worship Set"}
              </h1>
              <p className="text-sm text-muted-foreground">
                Build the song order for a service.
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            {setId && (
              <Button variant="outline" onClick={startPresentation}>
                <PlayCircle className="h-4 w-4" />
                Start Presentation
              </Button>
            )}
            <Button onClick={handleSave} disabled={saving}>
              <Save className="h-4 w-4" />
              {saving ? "Saving..." : "Save Set"}
            </Button>
          </div>
        </div>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-base">Set Details</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="set-name">Name</Label>
              <Input
                id="set-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Sunday Morning Worship"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="set-description">Description</Label>
              <Textarea
                id="set-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Notes for the worship team..."
                rows={2}
              />
            </div>
          </CardContent>
        </Card>

        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-semibold text-foreground">Songs</h2>
          <Button type="button" variant="outline" size="sm" onClick={() => setPickerOpen(true)}>
            <Plus className="h-4 w-4" />
            Add Song
          </Button>
        </div>

        {items.length === 0 ? (
          <p className="rounded-md border border-dashed border-border bg-muted/30 px-4 py-10 text-center text-sm text-muted-foreground">
            No songs added yet. Add songs to build the service order.
          </p>
        ) : (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
              <div className="flex flex-col gap-2">
                {items.map((song, i) => (
                  <SortableSongRow
                    key={song.id}
                    id={song.id}
                    index={i}
                    title={song.title}
                    author={song.author}
                    category={song.category}
                    onRemove={() => setItems((prev) => prev.filter((s) => s.id !== song.id))}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        )}
      </div>

      <SongPickerDialog
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        excludeIds={items.map((i) => i.id)}
        onAdd={(song) => {
          setItems((prev) => [...prev, song]);
        }}
      />
    </AppShell>
  );
}
