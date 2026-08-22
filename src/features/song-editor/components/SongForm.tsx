import { useState, type ReactNode } from "react";
import { toast } from "sonner";
import { Plus, ClipboardPaste } from "lucide-react";
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
import type { SongFormValues } from "@/features/songs/api";
import { SONG_CATEGORIES } from "@/types/database";
import { SongSectionEditor } from "./SongSectionEditor";
import { PasteSongDialog } from "./PasteSongDialog";
import { emptySection, makeKey } from "../sections";
import type { EditableSection } from "../types";

interface SongFormProps {
  form: SongFormValues;
  onFormChange: (patch: Partial<SongFormValues>) => void;
  sections: EditableSection[];
  onSectionsChange: (next: EditableSection[]) => void;
  /**
   * Extra fields for the details card. The encoder's template editor uses this
   * for copyright status and publish state, which have no equivalent on a
   * church's own song.
   */
  detailsExtra?: ReactNode;
}

/**
 * The song editing surface itself: metadata, sortable sections, paste import.
 *
 * Deliberately owns no persistence — the two pages that render it save to
 * different tables (a church's `songs` vs the shared `hymn_templates`), and
 * keeping the form ignorant of that is what lets them share it.
 */
export function SongForm({
  form,
  onFormChange,
  sections,
  onSectionsChange,
  detailsExtra,
}: SongFormProps) {
  const [pasteOpen, setPasteOpen] = useState(false);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
  );

  function updateSection(key: string, patch: Partial<EditableSection>) {
    onSectionsChange(sections.map((s) => (s.key === key ? { ...s, ...patch } : s)));
  }

  function removeSection(key: string) {
    onSectionsChange(sections.filter((s) => s.key !== key));
  }

  function addSection() {
    onSectionsChange([...sections, emptySection(sections)]);
  }

  function insertParsedSections(parsed: ParsedSection[], mode: "replace" | "append") {
    const incoming: EditableSection[] = parsed.map((s) => ({
      key: makeKey(),
      type: s.type,
      title: s.title,
      lyrics: s.lyrics,
    }));
    onSectionsChange(mode === "replace" ? incoming : [...sections, ...incoming]);
    toast.success(`Added ${incoming.length} section${incoming.length === 1 ? "" : "s"}.`);
  }

  /** Replacing is only offered when there's nothing but an untouched starter section. */
  const hasContent = sections.some((s) => s.lyrics.trim().length > 0);

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = sections.findIndex((s) => s.key === active.id);
    const newIndex = sections.findIndex((s) => s.key === over.id);
    onSectionsChange(arrayMove(sections, oldIndex, newIndex));
  }

  return (
    <>
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
              onChange={(e) => onFormChange({ title: e.target.value })}
              placeholder="Amazing Grace"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="author">Author</Label>
            <Input
              id="author"
              value={form.author}
              onChange={(e) => onFormChange({ author: e.target.value })}
              placeholder="John Newton"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="composer">Composer</Label>
            <Input
              id="composer"
              value={form.composer}
              onChange={(e) => onFormChange({ composer: e.target.value })}
              placeholder="Traditional"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Category</Label>
            <Select
              value={form.category || undefined}
              onValueChange={(v) => onFormChange({ category: v })}
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
                onChange={(e) => onFormChange({ key: e.target.value })}
                placeholder="G"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="tempo">Tempo</Label>
              <Input
                id="tempo"
                value={form.tempo}
                onChange={(e) => onFormChange({ tempo: e.target.value })}
                placeholder="Andante"
              />
            </div>
          </div>
          <div className="flex flex-col gap-1.5 sm:col-span-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={form.description}
              onChange={(e) => onFormChange({ description: e.target.value })}
              placeholder="Notes for the worship team..."
              rows={2}
            />
          </div>
          {detailsExtra}
        </CardContent>
      </Card>

      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-base font-semibold text-foreground">Song Sections</h2>
        <div className="flex gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => setPasteOpen(true)}>
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
    </>
  );
}
