import { useState, type FormEvent, type ReactNode } from "react";
import { CheckCircle2, Download, Heart, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { recordDownloadSignup, type DownloadSignup } from "../api";
import {
  DESKTOP_SIZE,
  DESKTOP_VERSION,
  DOWNLOAD_URL,
  INSTALL_STEPS,
} from "../download-info";

/**
 * Starts the download without leaving the page.
 *
 * A synthetic anchor click rather than `location.href = url`: the file is a
 * cross-origin redirect to a 108 MB .exe, and a click is what browsers treat
 * unambiguously as a user-initiated download. Assigning to location leaves the
 * page in a navigating state in some browsers, which would tear down the
 * dialog that is showing the install steps.
 */
function startDownload() {
  const link = document.createElement("a");
  link.href = DOWNLOAD_URL;
  link.rel = "noreferrer";
  document.body.appendChild(link);
  link.click();
  link.remove();
}

/**
 * Asks two questions, then hands over the installer.
 *
 * The survey is the point, but it is not a gate we are willing to fail closed
 * on: if the insert errors -- offline, Supabase down, a blocked request -- the
 * download starts anyway and the visitor never learns there was a database
 * involved. Losing one survey answer is cheap; a church volunteer who cannot
 * get the installer on a Saturday night is not.
 */
export function DownloadDialog({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [started, setStarted] = useState(false);
  const [churchName, setChurchName] = useState("");
  const [churchLocation, setChurchLocation] = useState("");
  // Which of the two paths is in flight, so only the button that was pressed
  // shows a spinner while both are disabled.
  const [pending, setPending] = useState<DownloadSignup["type"] | null>(null);

  const canSubmit =
    churchName.trim().length >= 2 && churchLocation.trim().length >= 2;

  function handleOpenChange(next: boolean) {
    setOpen(next);
    // Reset on the way out, so a second person on the same church computer
    // does not find the last one's answers still in the fields.
    if (!next) {
      setStarted(false);
      setChurchName("");
      setChurchLocation("");
      setPending(null);
    }
  }

  async function proceed(signup: DownloadSignup) {
    if (pending) return;
    setPending(signup.type);

    try {
      await recordDownloadSignup(signup);
    } catch (err) {
      // Deliberately swallowed -- see the note on this component.
      console.error("Could not record the download survey", err);
    }

    startDownload();
    setPending(null);
    setStarted(true);
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    void proceed({
      type: "church",
      churchName: churchName.trim(),
      churchLocation: churchLocation.trim(),
    });
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>{children}</DialogTrigger>

      <DialogContent className="sm:max-w-lg">
        {started ? (
          <>
            <DialogHeader>
              <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-accent/15 text-accent-foreground">
                <CheckCircle2 className="h-5 w-5" />
              </div>
              <DialogTitle className="pt-3 font-display text-2xl">
                Your download has started
              </DialogTitle>
              <DialogDescription>
                Look in your downloads for SagipMusica-Setup.exe ({DESKTOP_SIZE}
                ). Here is what happens next.
              </DialogDescription>
            </DialogHeader>

            <ol className="space-y-5">
              {INSTALL_STEPS.map((step, i) => (
                <li key={step.title} className="flex gap-4">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-secondary text-xs font-semibold text-foreground">
                    {i + 1}
                  </span>
                  <div>
                    <h3 className="text-sm font-semibold text-foreground">
                      {step.title}
                    </h3>
                    <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                      {step.body}
                    </p>
                  </div>
                </li>
              ))}
            </ol>

            <div className="staff-rule my-1 opacity-50" aria-hidden="true" />

            <p className="text-sm text-muted-foreground">
              Nothing downloading?{" "}
              <a
                href={DOWNLOAD_URL}
                className="font-medium text-primary hover:underline"
              >
                Start it again
              </a>
              .
            </p>

            <Button
              variant="outline"
              className="w-full"
              onClick={() => handleOpenChange(false)}
            >
              Done
            </Button>
          </>
        ) : (
          <>
            <DialogHeader>
              <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-accent/15 text-accent-foreground">
                <Heart className="h-5 w-5" />
              </div>
              <DialogTitle className="pt-3 font-display text-2xl">
                Thank you for downloading SagipMusica
              </DialogTitle>
              <DialogDescription>
                Before the file starts, we would love to know you a little.
                Two questions, and then the download begins.
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="download-church-name">
                  What is your church called?
                </Label>
                <Input
                  id="download-church-name"
                  value={churchName}
                  onChange={(e) => setChurchName(e.target.value)}
                  placeholder="Fundamental Baptist Church"
                  maxLength={120}
                  autoComplete="organization"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="download-church-location">
                  Where do you worship?
                </Label>
                <Input
                  id="download-church-location"
                  value={churchLocation}
                  onChange={(e) => setChurchLocation(e.target.value)}
                  placeholder="City, province or country"
                  maxLength={160}
                  autoComplete="address-level2"
                  required
                />
              </div>

              <Button
                type="submit"
                size="lg"
                className="w-full gap-2"
                disabled={!canSubmit || pending !== null}
              >
                {pending === "church" ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Download className="h-4 w-4" />
                )}
                {pending === "church" ? "Starting…" : "Start the download"}
              </Button>

              {/* The way out for anyone not with a church. It has to be a real
                  offer rather than a grudging one: a required church field
                  either turns them away or gets filled in with something
                  invented, and both are worse than an honest visitor row. */}
              <Button
                type="button"
                variant="ghost"
                className="h-auto w-full whitespace-normal py-2.5 text-center text-sm font-normal text-muted-foreground"
                disabled={pending !== null}
                onClick={() => void proceed({ type: "visitor" })}
              >
                {pending === "visitor" ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : null}
                I'm not with a church — I just want to explore the software
              </Button>

              <p className="text-center text-xs leading-relaxed text-muted-foreground">
                Version {DESKTOP_VERSION} · {DESKTOP_SIZE} · Windows 10 &amp; 11
                (64-bit). We only use this to know which churches we are
                building for — nothing is shared, and there is no mailing list.
              </p>
            </form>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
