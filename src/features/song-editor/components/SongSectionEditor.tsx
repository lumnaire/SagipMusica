import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { NotationUploader } from "@/features/media-editor/components/NotationUploader";
import { SECTION_TYPE_LABELS, type SectionType } from "@/types/database";
import type { EditableSection } from "../types";

interface SongSectionEditorProps {
  songId: string | null;
  section: EditableSection;
  index: number;
  onChange: (patch: Partial<EditableSection>) => void;
  onRemove: () => void;
}

const SECTION_TYPES = Object.keys(SECTION_TYPE_LABELS) as SectionType[];

export function SongSectionEditor({
  songId,
  section,
  index,
  onChange,
  onRemove,
}: SongSectionEditorProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: section.key });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="rounded-lg border border-border bg-card p-4 shadow-sm"
    >
      <div className="mb-3 flex items-center gap-2">
        <button
          type="button"
          className="cursor-grab touch-none text-muted-foreground hover:text-foreground active:cursor-grabbing"
          {...attributes}
          {...listeners}
          aria-label="Drag to reorder section"
        >
          <GripVertical className="h-4.5 w-4.5" />
        </button>
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Section {index + 1}
        </span>
        <div className="ml-auto">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-destructive hover:text-destructive"
            onClick={onRemove}
            title="Remove section"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-muted-foreground">Section Type</label>
          <Select
            value={section.type}
            onValueChange={(v) => onChange({ type: v as SectionType })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SECTION_TYPES.map((t) => (
                <SelectItem key={t} value={t}>
                  {SECTION_TYPE_LABELS[t]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-muted-foreground">Section Title</label>
          <Input
            value={section.title}
            onChange={(e) => onChange({ title: e.target.value })}
            placeholder="e.g. Verse 1"
          />
        </div>
      </div>

      <div className="mt-3 flex flex-col gap-1.5">
        <label className="text-xs font-medium text-muted-foreground">Lyrics</label>
        <Textarea
          value={section.lyrics}
          onChange={(e) => onChange({ lyrics: e.target.value })}
          rows={5}
          placeholder={"Amazing grace, how sweet the sound\nThat saved a wretch like me..."}
          className="font-serif text-[15px] leading-relaxed"
        />
      </div>

      <div className="mt-3 flex flex-col gap-1.5">
        <label className="text-xs font-medium text-muted-foreground">Musical Notation Image</label>
        {songId && section.id ? (
          <NotationUploader
            songId={songId}
            sectionId={section.id}
            media={section.media}
            onChange={(media) => onChange({ media })}
          />
        ) : (
          <p className="rounded-md border border-dashed border-border bg-muted/30 px-3 py-4 text-center text-xs text-muted-foreground">
            Save the song to enable uploading a notation image for this section.
          </p>
        )}
      </div>
    </div>
  );
}
