import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { BibleBrowser } from "./BibleBrowser";
import type { ParsedReference } from "../reference";

interface BibleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Put the passage on the screen now, replacing what is up. */
  onPresent: (reference: ParsedReference) => void;
  /** Queue it at the end of the running presentation, without going live. */
  onAdd?: (reference: ParsedReference) => void;
}

/**
 * The scripture picker over a running presentation. Same browser as the Bible
 * page, sized for a dialog, with the extra option to queue the passage rather
 * than cut to it — see presentation-store's appendSlides for why that
 * distinction matters when a service is live.
 */
export function BibleDialog({ open, onOpenChange, onPresent, onAdd }: BibleDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92svh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle className="font-display text-xl">Bible</DialogTitle>
          <DialogDescription>
            Type a reference or search the text, then add the passage to this presentation.
          </DialogDescription>
        </DialogHeader>

        <BibleBrowser
          compact
          onPresent={(reference) => {
            onPresent(reference);
            onOpenChange(false);
          }}
          onAdd={
            onAdd &&
            ((reference) => {
              onAdd(reference);
              onOpenChange(false);
            })
          }
        />
      </DialogContent>
    </Dialog>
  );
}
