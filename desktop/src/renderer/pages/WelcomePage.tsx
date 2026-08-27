import { useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";
import {
  ArrowRight,
  BookOpen,
  Church,
  Library,
  MonitorPlay,
  Sparkles,
  WifiOff,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/stores/auth-store";
import { useChurchStore } from "@/stores/church-store";
import { invoke } from "../data/invoke";
import sagipmusicaLogo from "@/assets/sagipmusica-logo1.png";

/**
 * First run on the desktop.
 *
 * The hosted app has an onboarding flow because a new account genuinely has
 * nothing: no church, no songs, and a signup that has to ask who you are. A
 * fresh install has the opposite problem — the installer already put a church
 * row, 419 hymns and the whole King James Version on the machine, and without
 * being told so the user opens a dashboard belonging to somebody called "My
 * Church" and has no idea any of it is there.
 *
 * So this is two things in one: the two questions worth asking (what is your
 * church called, what should we call you), and an answer to "what did I just
 * install". It runs once, before the dashboard is reachable, and hands over to
 * the spotlight tour — see setup_completed in the contract for why those are
 * separate flags.
 *
 * Deliberately not skippable past the naming step in the sense of being
 * dismissed unanswered: the church name is on every screen and in the
 * projector's window title, and "My Church" on a sanctuary wall is worse than
 * one extra click. It IS pre-filled and can be accepted as-is.
 */
export function WelcomePage() {
  const church = useChurchStore((s) => s.church);
  const updateChurchName = useChurchStore((s) => s.updateName);
  const profile = useAuthStore((s) => s.profile);
  const completeSetup = useAuthStore((s) => s.completeSetup);

  const [step, setStep] = useState(0);
  const [churchName, setChurchName] = useState("");
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [hymnCount, setHymnCount] = useState<number | null>(null);

  useEffect(() => {
    // Pre-filled with whatever the seed set, so accepting it is one click.
    if (church?.name) setChurchName(church.name);
  }, [church?.name]);

  useEffect(() => {
    if (profile?.name) setName(profile.name);
  }, [profile?.name]);

  useEffect(() => {
    invoke("dashboard.stats")
      .then((stats) => setHymnCount(stats.totalSongs))
      .catch(() => setHymnCount(null));
  }, []);

  async function handleChurch(e: FormEvent) {
    e.preventDefault();
    const trimmed = churchName.trim();
    if (!trimmed) return;

    setSaving(true);
    const { error } = await updateChurchName(trimmed);
    setSaving(false);

    if (error) {
      toast.error(error);
      return;
    }
    setStep(2);
  }

  async function handleFinish(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await completeSetup({ name });
    } catch (err) {
      setSaving(false);
      toast.error(err instanceof Error ? err.message : "Couldn't save that. Try again.");
      return;
    }
    // No navigation: App.tsx swaps this page out for the router the moment
    // setupCompleted flips, and the dashboard's tour takes it from there.
  }

  return (
    <div className="flex min-h-svh items-center justify-center bg-muted/30 p-4">
      <div className="w-full max-w-lg">
        <div className="mb-6 flex flex-col items-center text-center">
          <img src={sagipmusicaLogo} alt="" className="h-14 w-14 object-contain" />
          <p className="mt-2 text-sm text-muted-foreground">SagipMusica</p>
        </div>

        {step === 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="font-display text-2xl">
                Welcome — everything is already here
              </CardTitle>
              <CardDescription>
                Nothing to download and nothing to sign up for. This is what came with
                the app.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Highlight
                icon={Library}
                title={
                  hymnCount === null
                    ? "Your hymnal, already stocked"
                    : `${hymnCount} hymns, already in your hymnal`
                }
                body="Words and verses ready to project. Edit them, add your own, or delete the ones you don't sing."
              />
              <Highlight
                icon={BookOpen}
                title="The whole Bible, built in"
                body="The complete King James Version. Type a reference like John 3:16, or search for the words you remember."
              />
              <Highlight
                icon={WifiOff}
                title="Works with the internet off"
                body="Everything lives on this computer. Nothing you do here needs a connection — which is the point."
              />
              <Highlight
                icon={MonitorPlay}
                title="Built for the projector"
                body="Put songs and scripture on the sanctuary screen from a second window, with the controls kept on your laptop."
              />
            </CardContent>
            <CardFooter>
              <Button className="w-full" onClick={() => setStep(1)}>
                Get started
                <ArrowRight className="h-4 w-4" />
              </Button>
            </CardFooter>
          </Card>
        )}

        {step === 1 && (
          <Card>
            <CardHeader>
              <StepCount current={1} />
              <CardTitle className="flex items-center gap-2 font-display text-2xl">
                <Church className="h-5 w-5 text-primary" />
                What's your church called?
              </CardTitle>
              <CardDescription>
                It appears in the sidebar and on the projector window. You can change it
                later in Settings.
              </CardDescription>
            </CardHeader>
            <form onSubmit={handleChurch}>
              <CardContent className="flex flex-col gap-1.5">
                <Label htmlFor="church-name">Church name</Label>
                <Input
                  id="church-name"
                  value={churchName}
                  onChange={(e) => setChurchName(e.target.value)}
                  placeholder="Fundamental Baptist Church"
                  autoFocus
                  maxLength={80}
                />
              </CardContent>
              <CardFooter className="gap-2">
                <Button type="button" variant="outline" onClick={() => setStep(0)}>
                  Back
                </Button>
                <Button type="submit" className="flex-1" disabled={saving || !churchName.trim()}>
                  {saving ? "Saving…" : "Continue"}
                  {!saving && <ArrowRight className="h-4 w-4" />}
                </Button>
              </CardFooter>
            </form>
          </Card>
        )}

        {step === 2 && (
          <Card>
            <CardHeader>
              <StepCount current={2} />
              <CardTitle className="flex items-center gap-2 font-display text-2xl">
                <Sparkles className="h-5 w-5 text-primary" />
                And what should we call you?
              </CardTitle>
              <CardDescription>
                Only used to greet you on the dashboard. Leave it blank if you'd rather
                not — nothing here is sent anywhere.
              </CardDescription>
            </CardHeader>
            <form onSubmit={handleFinish}>
              <CardContent className="flex flex-col gap-1.5">
                <Label htmlFor="your-name">Your name</Label>
                <Input
                  id="your-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your name"
                  autoFocus
                  maxLength={80}
                />
              </CardContent>
              <CardFooter className="gap-2">
                <Button type="button" variant="outline" onClick={() => setStep(1)}>
                  Back
                </Button>
                <Button type="submit" className="flex-1" disabled={saving}>
                  {saving ? "Finishing…" : "Open SagipMusica"}
                  {!saving && <ArrowRight className="h-4 w-4" />}
                </Button>
              </CardFooter>
            </form>
          </Card>
        )}
      </div>
    </div>
  );
}

function StepCount({ current }: { current: number }) {
  return (
    <div className="flex items-center gap-1.5 pb-1">
      {[1, 2].map((n) => (
        <span
          key={n}
          className={cn(
            "h-1.5 rounded-full transition-colors",
            n === current ? "w-6 bg-primary" : "w-3 bg-muted-foreground/25",
          )}
        />
      ))}
      <span className="ml-1.5 text-xs text-muted-foreground">Step {current} of 2</span>
    </div>
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
    <div className="flex items-start gap-3 rounded-lg border border-border bg-muted/40 p-3.5">
      <Icon className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
      <div>
        <p className="text-sm font-medium text-foreground">{title}</p>
        <p className="mt-0.5 text-sm text-muted-foreground">{body}</p>
      </div>
    </div>
  );
}
