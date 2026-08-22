import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { Save, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SongForm } from "@/features/song-editor/components/SongForm";
import { emptySection } from "@/features/song-editor/sections";
import type { EditableSection } from "@/features/song-editor/types";
import {
  createTemplate,
  fetchTemplateWithSections,
  saveTemplateSections,
  setTemplateStatus,
  updateTemplate,
  type TemplateFormValues,
} from "@/features/encoder/api";
import {
  COPYRIGHT_STATUS_LABELS,
  type CopyrightStatus,
  type TemplateStatus,
} from "@/types/database";
import { EncoderShell } from "./EncoderShell";

const EMPTY_FORM: TemplateFormValues = {
  title: "",
  author: "",
  composer: "",
  category: "",
  key: "",
  tempo: "",
  description: "",
  copyright_status: "public_domain",
};

export function TemplateEditorPage() {
  const { id } = useParams<{ id: string }>();
  const isNew = !id;
  const navigate = useNavigate();

  const [templateId, setTemplateId] = useState<string | null>(id ?? null);
  const [form, setForm] = useState<TemplateFormValues>(EMPTY_FORM);
  const [sections, setSections] = useState<EditableSection[]>([]);
  const [existingSectionIds, setExistingSectionIds] = useState<string[]>([]);
  const [status, setStatus] = useState<TemplateStatus>("draft");
  const [isStarter, setIsStarter] = useState(false);
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isNew) {
      setSections([emptySection([])]);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const template = await fetchTemplateWithSections(id!);
        if (cancelled) return;
        setForm({
          title: template.title,
          author: template.author ?? "",
          composer: template.composer ?? "",
          category: template.category ?? "",
          key: template.key ?? "",
          tempo: template.tempo ?? "",
          description: template.description ?? "",
          copyright_status: template.copyright_status,
        });
        setSections(
          template.sections.map((s) => ({
            key: s.id,
            id: s.id,
            type: s.type,
            title: s.title,
            lyrics: s.lyrics,
          })),
        );
        setExistingSectionIds(template.sections.map((s) => s.id));
        setStatus(template.status);
        setIsStarter(template.is_starter);
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

  async function persist(): Promise<string | null> {
    let currentId = templateId;
    if (!currentId) {
      const created = await createTemplate(form);
      currentId = created.id;
      setTemplateId(created.id);
    } else {
      await updateTemplate(currentId, form);
    }

    const saved = await saveTemplateSections(
      currentId,
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
    return currentId;
  }

  async function handleSave() {
    if (!form.title.trim()) {
      toast.error("Song title is required.");
      return;
    }
    setSaving(true);
    try {
      const savedId = await persist();
      toast.success(isNew ? "Song created." : "Song saved.");
      if (isNew && savedId) navigate(`/encoder/songs/${savedId}`, { replace: true });
    } catch (err) {
      console.error(err);
      toast.error("Failed to save song.");
    } finally {
      setSaving(false);
    }
  }

  /** Saves first, so publishing can never expose a half-finished draft. */
  async function handlePublishToggle() {
    if (!form.title.trim()) {
      toast.error("Song title is required.");
      return;
    }
    const next: TemplateStatus = status === "published" ? "draft" : "published";
    // A metadata_only song is meant to ship without words — the church adds
    // them under its own licence — so it is the one case with nothing to check.
    if (
      next === "published" &&
      form.copyright_status !== "metadata_only" &&
      !sections.some((s) => s.lyrics.trim())
    ) {
      toast.error("Add lyrics before publishing, or mark this song as having none.");
      return;
    }
    setSaving(true);
    try {
      const savedId = await persist();
      if (!savedId) return;
      await setTemplateStatus(savedId, next);
      setStatus(next);
      toast.success(
        next === "published"
          ? "Published. Church admins can now add this song."
          : "Unpublished. Churches that already added it keep their copy.",
      );
      if (isNew) navigate(`/encoder/songs/${savedId}`, { replace: true });
    } catch (err) {
      console.error(err);
      toast.error("Failed to change status.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <EncoderShell>
        <p className="text-sm text-muted-foreground">Loading song...</p>
      </EncoderShell>
    );
  }

  return (
    <EncoderShell>
      <div className="mx-auto max-w-3xl">
        <div className="mb-6 flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate("/encoder")}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-semibold text-foreground">
                  {isNew ? "New Library Song" : "Edit Library Song"}
                </h1>
                {!isNew && (
                  <Badge variant={status === "published" ? "default" : "outline"}>
                    {status === "published" ? "Published" : "Draft"}
                  </Badge>
                )}
              </div>
              <p className="text-sm text-muted-foreground">
                {status === "published"
                  ? "Live in the library. Edits here never change copies churches already took."
                  : "Drafts are private to you until you publish."}
              </p>
            </div>
          </div>
          <div className="flex shrink-0 gap-2">
            <Button variant="outline" onClick={handlePublishToggle} disabled={saving}>
              {status === "published" ? "Unpublish" : "Publish"}
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              <Save className="h-4 w-4" />
              {saving ? "Saving..." : "Save"}
            </Button>
          </div>
        </div>

        {isStarter && (
          <p className="mb-4 rounded-md border border-border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
            This is a starter hymn — every new church receives a copy of it at signup.
          </p>
        )}

        <SongForm
          form={form}
          onFormChange={(patch) => setForm((f) => ({ ...f, ...patch }))}
          sections={sections}
          onSectionsChange={setSections}
          detailsExtra={
            <div className="flex flex-col gap-1.5 sm:col-span-2">
              <Label>Copyright</Label>
              <Select
                value={form.copyright_status}
                onValueChange={(v) =>
                  setForm((f) => ({ ...f, copyright_status: v as CopyrightStatus }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(
                    Object.keys(COPYRIGHT_STATUS_LABELS) as CopyrightStatus[]
                  ).map((value) => (
                    <SelectItem key={value} value={value}>
                      {COPYRIGHT_STATUS_LABELS[value]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                This song goes out to every church on the platform. Only publish lyrics that are
                public domain or that you hold the right to distribute — otherwise mark it "no
                lyrics" and let each church add the words under its own CCLI licence.
              </p>
            </div>
          }
        />
      </div>
    </EncoderShell>
  );
}
