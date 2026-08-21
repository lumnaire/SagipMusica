import { useEffect, useMemo, useState } from "react";
import { ClipboardPaste } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { SECTION_TYPE_LABELS } from "@/types/database";
import { parseSongText, type ParsedSection } from "@/features/song-editor/lyrics-parser";

const PLACEHOLDER = `Verse 1
Amazing grace, how sweet the sound
That saved a wretch like me

Chorus
Praise the Lord, praise the Lord

Verse 2
'Twas grace that taught my heart to fear`;

interface PasteSongDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** True when the editor holds nothing worth keeping, so Replace is the sane default. */
  canReplace: boolean;
  onInsert: (sections: ParsedSection[], mode: "replace" | "append") => void;
}

export function PasteSongDialog({
  open,
  onOpenChange,
  canReplace,
  onInsert,
}: PasteSongDialogProps) {
  const [text, setText] = useState("");
  const [stripChords, setStripChords] = useState(true);
  const [mode, setMode] = useState<"replace" | "append">("replace");

  useEffect(() => {
    if (open) {
      setText("");
      setStripChords(true);
      setMode(canReplace ? "replace" : "append");
    }
  }, [open, canReplace]);

  // Re-parsed on every keystroke so the preview always reflects what will be
  // inserted. The parser is pure string work, so this is cheap.
  const sections = useMemo(
    () => parseSongText(text, { stripChords }),
    [text, stripChords],
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">Paste a whole song</DialogTitle>
          <DialogDescription>
            Paste the lyrics and we'll split them into sections. Leave a blank
            line between stanzas; headings like "Verse 1", "Chorus" or "Bridge"
            are picked up automatically.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <Textarea
            autoFocus
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={PLACEHOLDER}
            rows={10}
            className="font-mono text-sm"
            aria-label="Song lyrics to import"
          />

          <div className="flex items-start justify-between gap-4">
            <div>
              <Label htmlFor="strip-chords">Remove chord lines</Label>
              <p className="mt-1 text-xs text-muted-foreground">
                Drops lines that are only chords, plus CCLI and copyright
                footers. The projector shows words only.
              </p>
            </div>
            <Switch id="strip-chords" checked={stripChords} onCheckedChange={setStripChords} />
          </div>

          {canReplace && (
            <div className="flex items-start justify-between gap-4">
              <div>
                <Label htmlFor="replace-mode">Replace existing sections</Label>
                <p className="mt-1 text-xs text-muted-foreground">
                  Off to add these after what's already there.
                </p>
              </div>
              <Switch
                id="replace-mode"
                checked={mode === "replace"}
                onCheckedChange={(v) => setMode(v ? "replace" : "append")}
              />
            </div>
          )}

          <div>
            <p className="eyebrow mb-2">
              Preview{sections.length > 0 ? ` — ${sections.length} sections` : ""}
            </p>
            {sections.length === 0 ? (
              <p className="rounded-md border border-dashed border-border bg-muted/30 px-4 py-6 text-center text-sm text-muted-foreground">
                {text.trim()
                  ? "Nothing to import from that text."
                  : "Paste your lyrics above to see how they'll be split."}
              </p>
            ) : (
              <ul className="divide-y divide-border overflow-hidden rounded-md border border-border">
                {sections.map((section, i) => (
                  <li
                    key={`${section.title}-${i}`}
                    className={cn("flex items-start gap-3 px-3 py-2", i % 2 === 1 && "bg-muted/30")}
                  >
                    <Badge variant="secondary" className="mt-0.5 shrink-0">
                      {SECTION_TYPE_LABELS[section.type]}
                    </Badge>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-foreground">
                        {section.title}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {section.lyrics.split("\n")[0]}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            disabled={sections.length === 0}
            onClick={() => {
              onInsert(sections, mode);
              onOpenChange(false);
            }}
          >
            <ClipboardPaste className="h-4 w-4" />
            Insert {sections.length} section{sections.length === 1 ? "" : "s"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
