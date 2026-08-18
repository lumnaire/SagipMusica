import { useRef, useState } from "react";
import { toast } from "sonner";
import { ImagePlus, Crop, Trash2, Music3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { NotationImageEditor } from "./NotationImageEditor";
import {
  uploadNotationImage,
  getMediaPublicUrl,
  createSectionMedia,
  updateSectionMediaCrop,
  deleteSectionMedia,
} from "@/features/media-editor/api";
import type { CropConfig, SectionMedia } from "@/types/database";

interface NotationUploaderProps {
  songId: string;
  sectionId: string;
  media: SectionMedia | null;
  onChange: (media: SectionMedia | null) => void;
}

function loadImageSize(url: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
    img.onerror = reject;
    img.src = url;
  });
}

export function NotationUploader({ songId, sectionId, media, onChange }: NotationUploaderProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editorImageUrl, setEditorImageUrl] = useState<string | null>(null);

  const publicUrl = media ? getMediaPublicUrl(media.storage_path) : null;

  async function handleFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    if (!sectionId) {
      toast.error("Save the song once before uploading notation images.");
      return;
    }

    setUploading(true);
    try {
      const storagePath = await uploadNotationImage(songId, sectionId, file);
      const url = getMediaPublicUrl(storagePath);
      const { width, height } = await loadImageSize(url);
      const created = await createSectionMedia(sectionId, storagePath, "notation", {
        x: 0,
        y: 0,
        width,
        height,
        scale: 1,
      });
      onChange(created);
      toast.success("Musical notation uploaded.");
    } catch (err) {
      console.error(err);
      toast.error("Failed to upload image. Please try again.");
    } finally {
      setUploading(false);
    }
  }

  function openEditor() {
    if (!publicUrl) return;
    setEditorImageUrl(publicUrl);
    setEditorOpen(true);
  }

  async function handleSaveCrop(crop: CropConfig) {
    if (!media) return;
    try {
      const updated = await updateSectionMediaCrop(media.id, crop);
      onChange(updated);
      toast.success("Crop saved.");
      setEditorOpen(false);
    } catch (err) {
      console.error(err);
      toast.error("Failed to save crop.");
    }
  }

  async function handleRemove() {
    if (!media) return;
    try {
      await deleteSectionMedia(media.id, media.storage_path);
      onChange(null);
      toast.success("Notation image removed.");
    } catch (err) {
      console.error(err);
      toast.error("Failed to remove image.");
    }
  }

  return (
    <div className="rounded-md border border-dashed border-border bg-muted/30 p-3">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileSelected}
      />

      {!media ? (
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="flex w-full flex-col items-center justify-center gap-2 rounded-md py-6 text-sm text-muted-foreground transition-colors hover:bg-muted/60 disabled:opacity-50"
        >
          <ImagePlus className="h-6 w-6" />
          {uploading ? "Uploading..." : "Upload Musical Notes"}
        </button>
      ) : (
        <div className="flex items-center gap-3">
          <div className="flex h-16 w-28 shrink-0 items-center justify-center overflow-hidden rounded bg-white ring-1 ring-border">
            {publicUrl ? (
              <img src={publicUrl} alt="Musical notation" className="h-full w-full object-contain" />
            ) : (
              <Music3 className="h-5 w-5 text-muted-foreground" />
            )}
          </div>
          <div className="flex flex-1 flex-wrap gap-2">
            <Button type="button" size="sm" variant="outline" onClick={openEditor}>
              <Crop className="h-3.5 w-3.5" />
              Edit Crop
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => fileInputRef.current?.click()}>
              <ImagePlus className="h-3.5 w-3.5" />
              Replace
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="text-destructive hover:text-destructive"
              onClick={handleRemove}
            >
              <Trash2 className="h-3.5 w-3.5" />
              Remove
            </Button>
          </div>
        </div>
      )}

      {editorOpen && editorImageUrl && (
        <NotationImageEditor
          open={editorOpen}
          imageUrl={editorImageUrl}
          initialCrop={
            media
              ? {
                  x: media.crop_x,
                  y: media.crop_y,
                  width: media.crop_width,
                  height: media.crop_height,
                  scale: media.scale,
                }
              : null
          }
          onCancel={() => setEditorOpen(false)}
          onSave={handleSaveCrop}
        />
      )}
    </div>
  );
}
