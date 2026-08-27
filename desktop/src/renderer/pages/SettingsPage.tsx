import { useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Download, Upload } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { SupportCard } from "@/features/settings/components/SupportCard";
import {
  CreditsCard,
  CreditsRow,
} from "@/features/settings/components/CreditsCard";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useAuthStore } from "@/stores/auth-store";
import { useChurchStore } from "@/stores/church-store";
import { invoke } from "../data/invoke";
import type { AppInfo } from "@shared/contract";

/**
 * The desktop Settings page.
 *
 * Written fresh rather than aliased from the web one, which is mostly account
 * management — email, password, delete account — none of which exists when the
 * data lives in a file on this machine. What replaces it is the thing that
 * actually matters offline: backups.
 */
export function SettingsPage() {
  const profile = useAuthStore((s) => s.profile);
  const updateName = useAuthStore((s) => s.updateName);
  const church = useChurchStore((s) => s.church);
  const updateChurchName = useChurchStore((s) => s.updateName);
  const updateAccentColor = useChurchStore((s) => s.updateAccentColor);

  const [churchName, setChurchName] = useState(church?.name ?? "");
  const [color, setColor] = useState(church?.accent_color ?? "#3730a3");
  const [name, setName] = useState(profile?.name ?? "");
  const [busy, setBusy] = useState<string | null>(null);
  const [info, setInfo] = useState<AppInfo | null>(null);

  useEffect(() => {
    if (church?.name) setChurchName(church.name);
    if (church?.accent_color) setColor(church.accent_color);
  }, [church?.name, church?.accent_color]);

  useEffect(() => {
    setName(profile?.name ?? "");
  }, [profile?.name]);

  useEffect(() => {
    invoke("app.info")
      .then(setInfo)
      .catch(() => setInfo(null));
  }, []);

  async function runAction(
    key: string,
    action: () => Promise<{ error: string | null }>,
    success: string,
  ) {
    setBusy(key);
    const { error } = await action();
    setBusy(null);
    if (error) {
      toast.error(error);
      return false;
    }
    toast.success(success);
    return true;
  }

  async function handleChurchSubmit(e: FormEvent) {
    e.preventDefault();
    await runAction("church", () => updateChurchName(churchName.trim()), "Church name updated.");
  }

  async function handleProfileSubmit(e: FormEvent) {
    e.preventDefault();
    await runAction("profile", () => updateName(name.trim()), "Name updated.");
  }

  async function handleExport() {
    setBusy("export");
    try {
      const result = await invoke("backup.export");
      if (result.completed) toast.success(`Backup saved to ${result.path}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't save the backup.");
    } finally {
      setBusy(null);
    }
  }

  async function handleImport() {
    setBusy("import");
    try {
      // On success the main process replaces the database and relaunches, so
      // nothing after this line runs. Only a cancel or a failure returns here.
      await invoke("backup.import");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't restore that file.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <AppShell>
      <div className="mx-auto max-w-2xl space-y-6">
        <div>
          <h1 className="font-display text-2xl text-foreground">Settings</h1>
          <p className="text-sm text-muted-foreground">
            Manage your church and your copy of SagipMusica.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Church</CardTitle>
            <CardDescription>
              The name and colour that appear across the app.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-5">
            <form className="flex flex-col gap-1.5" onSubmit={handleChurchSubmit}>
              <Label htmlFor="church-name">Church name</Label>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Input
                  id="church-name"
                  value={churchName}
                  onChange={(e) => setChurchName(e.target.value)}
                />
                <Button
                  type="submit"
                  disabled={
                    busy === "church" || !churchName.trim() || churchName.trim() === church?.name
                  }
                >
                  {busy === "church" ? "Saving..." : "Save"}
                </Button>
              </div>
            </form>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="accent-color">Accent colour</Label>
              <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                <input
                  id="accent-color"
                  type="color"
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  className="h-10 w-14 shrink-0 cursor-pointer rounded-md border border-input bg-background p-1"
                />
                <Input
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  className="w-28 uppercase sm:w-32"
                  aria-label="Accent colour hex value"
                />
                <Button
                  className="w-full sm:w-auto"
                  onClick={() =>
                    runAction("color", () => updateAccentColor(color), "Colour updated.")
                  }
                  disabled={busy === "color" || color === church?.accent_color}
                >
                  {busy === "color" ? "Saving..." : "Save"}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Your name</CardTitle>
            <CardDescription>Used to greet you on the dashboard.</CardDescription>
          </CardHeader>
          <CardContent>
            <form className="flex flex-col gap-1.5" onSubmit={handleProfileSubmit}>
              <Label htmlFor="profile-name">Name</Label>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Input
                  id="profile-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your full name"
                />
                <Button
                  type="submit"
                  disabled={busy === "profile" || !name.trim() || name.trim() === profile?.name}
                >
                  {busy === "profile" ? "Saving..." : "Save"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Backup</CardTitle>
            <CardDescription>
              Everything lives on this computer, so nothing is backed up for you.
              Save a copy somewhere safe — a USB stick or a cloud folder — and you
              can move your hymnal to another machine, or recover it on this one.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 sm:flex-row">
            <Button onClick={handleExport} disabled={busy === "export"}>
              <Download className="mr-2 h-4 w-4" />
              {busy === "export" ? "Saving..." : "Save a backup"}
            </Button>

            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" disabled={busy === "import"}>
                  <Upload className="mr-2 h-4 w-4" />
                  Restore from a backup
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Replace everything on this computer?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Restoring overwrites every song and worship set currently in this
                    app with the contents of the backup file. SagipMusica restarts
                    once it is done. Save a backup first if you are not certain.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleImport}>Choose a file</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </CardContent>
        </Card>

        <SupportCard />

        <CreditsCard>
          <CreditsRow label="Version">{info?.version ?? "—"}</CreditsRow>
          <CreditsRow label="Your data is stored at" stacked>
            <code className="block break-all rounded bg-muted px-2 py-1 text-xs">
              {info?.databasePath ?? "—"}
            </code>
          </CreditsRow>
        </CreditsCard>

      </div>
    </AppShell>
  );
}
