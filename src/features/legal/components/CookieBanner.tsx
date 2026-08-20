import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Cookie } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useConsentStore } from "@/stores/consent-store";

export function CookieBanner() {
  const { consent, customizeOpen, load, acceptAll, rejectAll, save, openCustomize, setCustomizeOpen } =
    useConsentStore();

  useEffect(() => {
    load();
  }, [load]);

  const showBanner = consent === null;

  return (
    <>
      {showBanner && (
        <div
          role="dialog"
          aria-label="Cookie preferences"
          className="fixed inset-x-0 bottom-0 z-[60] border-t border-border bg-card/95 p-4 shadow-2xl backdrop-blur-md sm:p-5"
        >
          <div className="mx-auto flex max-w-5xl flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex gap-3">
              <Cookie className="mt-0.5 hidden h-5 w-5 shrink-0 text-primary sm:block" />
              <p className="text-sm leading-relaxed text-muted-foreground">
                We use storage that's needed to keep you signed in. We'd also
                like optional cookies to understand how SagipMusica is used —
                only if you agree. Read our{" "}
                <Link to="/cookies" className="font-medium text-primary hover:underline">
                  Cookie Policy
                </Link>
                .
              </p>
            </div>

            <div className="flex shrink-0 flex-wrap gap-2">
              <Button variant="ghost" size="sm" onClick={openCustomize}>
                Customize
              </Button>
              <Button variant="outline" size="sm" onClick={rejectAll}>
                Reject optional
              </Button>
              <Button size="sm" onClick={acceptAll}>
                Accept all
              </Button>
            </div>
          </div>
        </div>
      )}

      <CustomizeDialog
        open={customizeOpen}
        onOpenChange={setCustomizeOpen}
        initial={consent}
        onSave={save}
      />
    </>
  );
}

function CustomizeDialog({
  open,
  onOpenChange,
  initial,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initial: { preferences: boolean; analytics: boolean } | null;
  onSave: (categories: { preferences: boolean; analytics: boolean }) => void;
}) {
  const [preferences, setPreferences] = useState(initial?.preferences ?? false);
  const [analytics, setAnalytics] = useState(initial?.analytics ?? false);

  // Reopening should show what's currently saved, not the last unsaved edit.
  useEffect(() => {
    if (open) {
      setPreferences(initial?.preferences ?? false);
      setAnalytics(initial?.analytics ?? false);
    }
  }, [open, initial?.preferences, initial?.analytics]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">Cookie preferences</DialogTitle>
          <DialogDescription>
            Choose what SagipMusica may store on your device. You can change
            this any time from the footer.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-5 py-1">
          <div className="flex items-start justify-between gap-4">
            <div>
              <Label className="text-sm font-medium text-foreground">
                Strictly necessary
              </Label>
              <p className="mt-1 text-sm text-muted-foreground">
                Keeps you signed in and remembers this choice. The app can't
                work without it.
              </p>
            </div>
            <Switch checked disabled aria-label="Strictly necessary storage, always on" />
          </div>

          <div className="flex items-start justify-between gap-4">
            <div>
              <Label htmlFor="consent-preferences" className="text-sm font-medium text-foreground">
                Preferences
              </Label>
              <p className="mt-1 text-sm text-muted-foreground">
                Remembers interface choices between visits.
              </p>
            </div>
            <Switch
              id="consent-preferences"
              checked={preferences}
              onCheckedChange={setPreferences}
            />
          </div>

          <div className="flex items-start justify-between gap-4">
            <div>
              <Label htmlFor="consent-analytics" className="text-sm font-medium text-foreground">
                Analytics
              </Label>
              <p className="mt-1 text-sm text-muted-foreground">
                Helps us see which features get used. We don't run analytics
                today — if we add it, this setting decides whether it applies
                to you.
              </p>
            </div>
            <Switch id="consent-analytics" checked={analytics} onCheckedChange={setAnalytics} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onSave({ preferences: false, analytics: false })}>
            Reject optional
          </Button>
          <Button onClick={() => onSave({ preferences, analytics })}>Save preferences</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
