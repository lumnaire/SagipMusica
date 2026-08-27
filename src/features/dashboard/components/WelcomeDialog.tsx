import { useNavigate } from "react-router-dom";
import { BookOpen, Library, ListMusic, PartyPopper } from "lucide-react";
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
      <DialogContent className="max-h-[92svh] overflow-y-auto sm:max-w-lg">
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

        {/* The two things a church already has on day one, before it has
            entered anything of its own. */}
        <div className="space-y-2.5">
          <Highlight
            icon={Library}
            title={`${songCount} hymns are already in your hymnal`}
            body="Start your worship with this — with verses ready to project. Edit or remove any of them."
          />
          <Highlight
            icon={BookOpen}
            title="The whole Bible is built in"
            body="The complete King James Version, ready to present. Type a reference like John 3:16, or search for the words you remember — and it works even when the church WiFi doesn't."
          />
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
              navigate("/bible");
            }}
          >
            <BookOpen className="h-4 w-4" />
            Open the Bible
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

function Highlight({
  icon: Icon,
  title,
  body,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  body: string;
}) {
  return (
    <div className="rounded-lg border border-border bg-muted/40 p-4">
      <div className="flex items-start gap-3">
        <Icon className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
        <div>
          <p className="text-sm font-medium text-foreground">{title}</p>
          <p className="mt-1 text-sm text-muted-foreground">{body}</p>
        </div>
      </div>
    </div>
  );
}
