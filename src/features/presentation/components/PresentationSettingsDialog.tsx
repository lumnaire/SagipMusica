import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { usePresentationStore } from "@/stores/presentation-store";

const BACKGROUND_PRESETS = [
  { label: "Midnight", value: "#0b0d12" },
  { label: "Deep Indigo", value: "#141c33" },
  { label: "Charcoal", value: "#1a1a1a" },
  { label: "Warm Black", value: "#120e0a" },
];

interface PresentationSettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function PresentationSettingsDialog({
  open,
  onOpenChange,
}: PresentationSettingsDialogProps) {
  const { style, updateStyle } = usePresentationStore();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Display Settings</DialogTitle>
          <DialogDescription>
            Adjust how the current presentation appears on the projector.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-5">
          <div className="flex flex-col gap-1.5">
            <Label>Background</Label>
            <div className="flex gap-2">
              {BACKGROUND_PRESETS.map((preset) => (
                <button
                  key={preset.value}
                  type="button"
                  title={preset.label}
                  onClick={() => updateStyle({ backgroundColor: preset.value })}
                  className="h-8 w-8 rounded-full ring-2 ring-offset-2 ring-offset-background transition-shadow"
                  style={{
                    background: preset.value,
                    boxShadow:
                      style.backgroundColor === preset.value
                        ? "0 0 0 2px var(--primary)"
                        : "none",
                  }}
                />
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between">
            <Label htmlFor="show-title">Show song title</Label>
            <Switch
              id="show-title"
              checked={style.showTitle}
              onCheckedChange={(v) => updateStyle({ showTitle: v })}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>Text alignment</Label>
            <Select
              value={style.textAlign}
              onValueChange={(v) => updateStyle({ textAlign: v as typeof style.textAlign })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="left">Left</SelectItem>
                <SelectItem value="center">Center</SelectItem>
                <SelectItem value="right">Right</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>Notation position</Label>
            <Select
              value={style.notationPosition}
              onValueChange={(v) =>
                updateStyle({ notationPosition: v as typeof style.notationPosition })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="top">Above lyrics</SelectItem>
                <SelectItem value="bottom">Below lyrics</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <Label>Lyrics font size</Label>
              <span className="text-xs text-muted-foreground">{style.lyricsFontSize}px</span>
            </div>
            <Slider
              value={[style.lyricsFontSize]}
              min={32}
              max={100}
              step={2}
              onValueChange={([v]) => updateStyle({ lyricsFontSize: v })}
            />
          </div>

          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <Label>Notation width</Label>
              <span className="text-xs text-muted-foreground">{style.notationMaxWidthPct}%</span>
            </div>
            <Slider
              value={[style.notationMaxWidthPct]}
              min={30}
              max={95}
              step={5}
              onValueChange={([v]) => updateStyle({ notationMaxWidthPct: v })}
            />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
