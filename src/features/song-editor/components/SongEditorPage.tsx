import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { Plus, Eye, Save, ArrowLeft, ClipboardPaste } from "lucide-react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { ParsedSection } from "@/features/song-editor/lyrics-parser";
import { SongSectionEditor } from "./SongSectionEditor";
import { PasteSongDialog } from "./PasteSongDialog";
import {
  createSong,
  updateSong,
  fetchSongWithSections,
  saveSongSections,
  type SongFormValues,
} from "@/features/songs/api";
import { SONG_CATEGORIES } from "@/types/database";
import type { EditableSection } from "../types";

const EMPTY_FORM: SongFormValues = {
  title: "",
  author: "",
  composer: "",
  category: "",
  key: "",
  tempo: "",
  description: "",
};

function makeKey() {
  return crypto.randomUUID();
}

/**
 * Numbers by how many verses already exist rather than by array position, so
 * adding a verse after a chorus gives "Verse 2" instead of "Verse 3".
 */
function emptySection(existing: EditableSection[]): EditableSection {
  const verseCount = existing.filter((s) => s.type === "verse").length;
  return {
    key: makeKey(),
    type: "verse",
    title: `Verse ${verseCount + 1}`,
    lyrics: "",
  };
}

export function SongEditorPage() {
  const { id } = useParams<{ id: string }>();
  const isNew = !id;
  const navigate = useNavigate();

  const [songId, setSongId] = useState<string | null>(id ?? null);
  const [form, setForm] = useState<SongFormValues>(EMPTY_FORM);
  const [sections, setSections] = useState<EditableSection[]>([]);
  const [existingSectionIds, setExistingSectionIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [pasteOpen, setPasteOpen] = useState(false);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  useEffect(() => {
    if (isNew) {
      setSections([emptySection([])]);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const song = await fetchSongWithSections(id!);
        if (cancelled) return;
        setForm({
          title: song.title,
          author: song.author ?? "",
          composer: song.composer ?? "",
          category: song.category ?? "",
          key: song.key ?? "",
          tempo: song.tempo ?? "",
          description: song.description ?? "",
        });
        setSections(
          song.sections.map((s) => ({
            key: s.id,
            id: s.id,
            type: s.type,
            title: s.title,
            lyrics: s.lyrics,
          })),
        );
        setExistingSectionIds(song.sections.map((s) => s.id));
      } catch (err) {
        console.error(err);
        toast.error("Failed to load song.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id, isNew]);

  function updateSection(key: string, patch: Partial<EditableSection>) {
    setSections((prev) => prev.map((s) => (s.key === key ? { ...s, ...patch } : s)));
  }

  function removeSection(key: string) {
    setSections((prev) => prev.filter((s) => s.key !== key));
  }

  function addSection() {
    setSections((prev) => [...prev, emptySection(prev)]);
  }

  function insertParsedSections(parsed: ParsedSection[], mode: "replace" | "append") {
    const incoming: EditableSection[] = parsed.map((s) => ({
      key: makeKey(),
      type: s.type,
      title: s.title,
      lyrics: s.lyrics,
    }));
    setSections((prev) => (mode === "replace" ? incoming : [...prev, ...incoming]));
    toast.success(
      `Added ${incoming.length} section${incoming.length === 1 ? "" : "s"}.`,
    );
  }

  /** Replacing is only offered when there's nothing but an untouched starter section. */
  const hasContent = sections.some((s) => s.lyrics.trim().length > 0);

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setSections((prev) => {
      const oldIndex = prev.findIndex((s) => s.key === active.id);
      const newIndex = prev.findIndex((s) => s.key === over.id);
      return arrayMove(prev, oldIndex, newIndex);
    });
  }

  async function handleSave() {
    if (!form.title.trim()) {
      toast.error("Song title is required.");
      return;
    }
    setSaving(true);
    try {
      let currentSongId = songId;
      if (!currentSongId) {
        const created = await createSong(form);
        currentSongId = created.id;
        setSongId(created.id);
      } else {
        await updateSong(currentSongId, form);
      }

      const saved = await saveSongSections(
        currentSongId,
        sections.map((s, i) => ({
          id: s.id,
          type: s.type,
          title: s.title || `Section ${i + 1}`,
          lyrics: s.lyrics,
          order_index: i,
        })),
        existingSectionIds,
      );

      setSections((prev) =>
        prev.map((s, i) => ({ ...s, id: saved[i]?.id ?? s.id, key: saved[i]?.id ?? s.key })),
      );
      setExistingSectionIds(saved.map((s) => s.id));

      toast.success(isNew ? "Song created." : "Song saved.");

      if (isNew) {
        navigate(`/songs/${currentSongId}/edit`, { replace: true });
      }
    } catch (err) {
      console.error(err);
      toast.error("Failed to save song.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <AppShell>
        <p className="text-sm text-muted-foreground">Loading song...</p>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="mx-auto max-w-3xl">
        <div className="mb-6 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate("/songs")}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="text-xl font-semibold text-foreground">
                {isNew ? "Add Song" : "Edit Song"}
              </h1>
              <p className="text-sm text-muted-foreground">
                Fill in the details and add stanzas.
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            {songId && (
              <Button variant="outline" onClick={() => navigate(`/songs/${songId}`)}>
                <Eye className="h-4 w-4" />
                Preview
              </Button>
            )}
            <Button onClick={handleSave} disabled={saving}>
              <Save className="h-4 w-4" />
              {saving ? "Saving..." : "Save Song"}
            </Button>
          </div>
        </div>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-base">Song Details</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5 sm:col-span-2">
              <Label htmlFor="title">Title</Label>
              <Input
                id="title"
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                placeholder="Amazing Grace"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="author">Author</Label>
              <Input
                id="author"
                value={form.author}
                onChange={(e) => setForm((f) => ({ ...f, author: e.target.value }))}
                placeholder="John Newton"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="composer">Composer</Label>
              <Input
                id="composer"
                value={form.composer}
                onChange={(e) => setForm((f) => ({ ...f, composer: e.target.value }))}
                placeholder="Traditional"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Category</Label>
              <Select
                value={form.category || undefined}
                onValueChange={(v) => setForm((f) => ({ ...f, category: v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a category" />
                </SelectTrigger>
                <SelectContent>
                  {SONG_CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="key">Key</Label>
                <Input
                  id="key"
                  value={form.key}
                  onChange={(e) => setForm((f) => ({ ...f, key: e.target.value }))}
                  placeholder="G"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="tempo">Tempo</Label>
                <Input
                  id="tempo"
                  value={form.tempo}
                  onChange={(e) => setForm((f) => ({ ...f, tempo: e.target.value }))}
                  placeholder="Andante"
                />
              </div>
            </div>
            <div className="flex flex-col gap-1.5 sm:col-span-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                placeholder="Notes for the worship team..."
                rows={2}
              />
            </div>
          </CardContent>
        </Card>

        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-semibold text-foreground">Song Sections</h2>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setPasteOpen(true)}
            >
              <ClipboardPaste className="h-4 w-4" />
              Paste whole song
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={addSection}>
              <Plus className="h-4 w-4" />
              Add Section
            </Button>
          </div>
        </div>

        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={sections.map((s) => s.key)} strategy={verticalListSortingStrategy}>
            <div className="flex flex-col gap-4">
              {sections.map((section, i) => (
                <SongSectionEditor
                  key={section.key}
                  section={section}
                  index={i}
                  onChange={(patch) => updateSection(section.key, patch)}
                  onRemove={() => removeSection(section.key)}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>

        {sections.length === 0 && (
          <p className="rounded-md border border-dashed border-border bg-muted/30 px-4 py-8 text-center text-sm text-muted-foreground">
            No sections yet. Paste a whole song, or add a verse to get started.
          </p>
        )}

        <PasteSongDialog
          open={pasteOpen}
          onOpenChange={setPasteOpen}
          canReplace={hasContent}
          onInsert={insertParsedSections}
        />

        <div className="mt-6 flex justify-end">
          <Button onClick={handleSave} disabled={saving}>
            <Save className="h-4 w-4" />
            {saving ? "Saving..." : "Save Song"}
          </Button>
        </div>
      </div>
    </AppShell>
  );
}
