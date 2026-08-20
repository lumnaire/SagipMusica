import { useNavigate } from "react-router-dom";
import { Library, ListMusic, PartyPopper } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface WelcomeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  churchName: string | null;
  songCount: number;
}

export function WelcomeDialog({
  open,
  onOpenChange,
  churchName,
  songCount,
}: WelcomeDialogProps) {
  const navigate = useNavigate();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="mb-1 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
            <PartyPopper className="h-6 w-6" />
          </div>
          <DialogTitle className="font-display text-2xl">
            You're all set{churchName ? `, ${churchName}` : ""}!
          </DialogTitle>
          <DialogDescription>
            Welcome to SagipMusica. Your dashboard is ready — and it isn't
            empty.
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-lg border border-border bg-muted/40 p-4">
          <div className="flex items-start gap-3">
            <Library className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
            <div>
              <p className="text-sm font-medium text-foreground">
                {songCount} hymns are already in your hymnal
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                Start your worship with this — with verses ready to project. Edit or remove any of them.
              </p>
            </div>
          </div>
        </div>

        <DialogFooter className="sm:flex-col sm:gap-2">
          <Button
            className="w-full"
            onClick={() => {
              onOpenChange(false);
              navigate("/songs");
            }}
          >
            <Library className="h-4 w-4" />
            Browse your hymnal
          </Button>
          <Button
            variant="outline"
            className="w-full"
            onClick={() => {
              onOpenChange(false);
              navigate("/sets/new");
            }}
          >
            <ListMusic className="h-4 w-4" />
            Build your first worship set
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
