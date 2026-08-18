import { useCallback, useState } from "react";
import Cropper, { type Area, type Point } from "react-easy-crop";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { RotateCcw } from "lucide-react";
import type { CropConfig } from "@/types/database";

interface NotationImageEditorProps {
  open: boolean;
  imageUrl: string;
  initialCrop?: CropConfig | null;
  onCancel: () => void;
  onSave: (crop: CropConfig) => void | Promise<void>;
}

const DEFAULT_ZOOM = 1;

export function NotationImageEditor({
  open,
  imageUrl,
  initialCrop,
  onCancel,
  onSave,
}: NotationImageEditorProps) {
  const [crop, setCrop] = useState<Point>({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(initialCrop?.scale ?? DEFAULT_ZOOM);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(
    initialCrop
      ? {
          x: initialCrop.x,
          y: initialCrop.y,
          width: initialCrop.width,
          height: initialCrop.height,
        }
      : null,
  );
  const [saving, setSaving] = useState(false);

  const onCropComplete = useCallback((_area: Area, areaPixels: Area) => {
    setCroppedAreaPixels(areaPixels);
  }, []);

  function handleReset() {
    setCrop({ x: 0, y: 0 });
    setZoom(DEFAULT_ZOOM);
  }

  async function handleSave() {
    if (!croppedAreaPixels) {
      toast.error("Adjust the crop area before saving.");
      return;
    }
    setSaving(true);
    try {
      await onSave({
        x: croppedAreaPixels.x,
        y: croppedAreaPixels.y,
        width: croppedAreaPixels.width,
        height: croppedAreaPixels.height,
        scale: zoom,
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onCancel()}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Notation Image Editor</DialogTitle>
          <DialogDescription>
            Crop, zoom, and position the musical notation so it fits the projector cleanly.
            The original image is never modified.
          </DialogDescription>
        </DialogHeader>

        <div className="relative h-96 w-full overflow-hidden rounded-md bg-neutral-900">
          <Cropper
            image={imageUrl}
            crop={crop}
            zoom={zoom}
            aspect={16 / 9}
            objectFit="contain"
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onCropComplete={onCropComplete}
          />
        </div>

        <div className="flex items-center gap-4">
          <span className="w-14 text-sm text-muted-foreground">Zoom</span>
          <Slider
            value={[zoom]}
            min={1}
            max={4}
            step={0.01}
            onValueChange={([v]) => setZoom(v)}
            className="flex-1"
          />
          <Button variant="ghost" size="icon" onClick={handleReset} title="Reset crop">
            <RotateCcw className="h-4 w-4" />
          </Button>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onCancel} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Saving..." : "Save Crop"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
