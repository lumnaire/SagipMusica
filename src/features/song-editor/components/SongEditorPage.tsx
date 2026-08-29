import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { Eye, Save, ArrowLeft } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import {
  createSong,
  updateSong,
  fetchSongWithSections,
  saveSongSections,
  type SongFormValues,
} from "@/features/songs/api";
import { HiddenToken } from "@/features/event/components/HiddenToken";
import { SongForm } from "./SongForm";
import { emptySection } from "../sections";
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

export function SongEditorPage() {
  const { id } = useParams<{ id: string }>();
  const isNew = !id;
  const navigate = useNavigate();

  const [songId, setSongId] = useState<string | null>(id ?? null);
  const [form, setForm] = useState<SongFormValues>(EMPTY_FORM);
  /**
   * The title as it is stored, which is not the same as form.title.
   *
   * The hunt's first code word is hidden on one particular song, and this is
   * what the page tells the server about itself. Taking it from the live field
   * would send a probe on every keystroke; taking it from the saved value
   * means one probe per song opened, and matches what the riddle asks for --
   * a song you have actually added to your hymnal.
   */
  const [savedTitle, setSavedTitle] = useState("");
  const [sections, setSections] = useState<EditableSection[]>([]);
  const [existingSectionIds, setExistingSectionIds] = useState<string[]>([]);
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
        setSavedTitle(song.title);
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
      setSavedTitle(form.title);

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

        <SongForm
          form={form}
          onFormChange={(patch) => setForm((f) => ({ ...f, ...patch }))}
          sections={sections}
          onSectionsChange={setSections}
        />

        <div className="mt-6 flex items-center justify-end gap-3">
          {/* Nothing renders here unless the server says this particular song
              is hiding something -- see HiddenToken. On every other song, and
              for everyone not in the hunt, this is an empty flex child. */}
          {songId && <HiddenToken slot="song-editor" context={savedTitle} />}
          <Button onClick={handleSave} disabled={saving}>
            <Save className="h-4 w-4" />
            {saving ? "Saving..." : "Save Song"}
          </Button>
        </div>
      </div>
    </AppShell>
  );
}
