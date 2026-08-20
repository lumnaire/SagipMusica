import { useEffect, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { AppShell } from "@/components/layout/AppShell";
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

export function SettingsPage() {
  const { profile, session, signOut, updateName, updateEmail, updatePassword, deleteAccount } =
    useAuthStore();
  const church = useChurchStore((s) => s.church);
  const updateChurchName = useChurchStore((s) => s.updateName);
  const updateAccentColor = useChurchStore((s) => s.updateAccentColor);
  const navigate = useNavigate();

  const isAdmin = profile?.role === "admin";
  const currentEmail = session?.user.email ?? "";

  const [churchName, setChurchName] = useState(church?.name ?? "");
  const [color, setColor] = useState(church?.accent_color ?? "#3730a3");
  const [name, setName] = useState(profile?.name ?? "");
  const [email, setEmail] = useState(currentEmail);
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    if (church?.name) setChurchName(church.name);
    if (church?.accent_color) setColor(church.accent_color);
  }, [church?.name, church?.accent_color]);

  useEffect(() => {
    setName(profile?.name ?? "");
  }, [profile?.name]);

  useEffect(() => {
    setEmail(currentEmail);
  }, [currentEmail]);

  async function handleSignOut() {
    await signOut();
    navigate("/");
  }

  async function runAction(key: string, action: () => Promise<{ error: string | null }>, success: string) {
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
    await runAction("profile", () => updateName(name.trim()), "Profile updated.");
  }

  async function handleEmailSubmit(e: FormEvent) {
    e.preventDefault();
    await runAction(
      "email",
      () => updateEmail(email.trim()),
      "Check your new inbox for a confirmation link.",
    );
  }

  async function handlePasswordSubmit(e: FormEvent) {
    e.preventDefault();
    const ok = await runAction("password", () => updatePassword(password), "Password updated.");
    if (ok) setPassword("");
  }

  async function handleDelete() {
    const { error } = await deleteAccount();
    if (error) {
      toast.error(error);
      return;
    }
    // Replace rather than push: the dashboard is gone, so Back should not
    // lead to a screen that no longer has an account behind it.
    navigate("/", { replace: true });
    toast.success("Your account has been deleted.");
  }

  return (
    <AppShell>
      <div className="mx-auto max-w-2xl space-y-6">
        <div>
          <h1 className="font-display text-2xl text-foreground">Settings</h1>
          <p className="text-sm text-muted-foreground">
            Manage your church and your account.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Church</CardTitle>
            <CardDescription>
              {isAdmin
                ? "Your church's name and colour appear across the dashboard."
                : "Only an admin can change these."}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-5">
            <form className="flex flex-col gap-1.5" onSubmit={handleChurchSubmit}>
              <Label htmlFor="church-name">Church name</Label>
              <div className="flex gap-2">
                <Input
                  id="church-name"
                  value={churchName}
                  disabled={!isAdmin}
                  onChange={(e) => setChurchName(e.target.value)}
                />
                <Button
                  type="submit"
                  disabled={
                    !isAdmin ||
                    busy === "church" ||
                    !churchName.trim() ||
                    churchName.trim() === church?.name
                  }
                >
                  {busy === "church" ? "Saving..." : "Save"}
                </Button>
              </div>
            </form>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="accent-color">Accent colour</Label>
              <div className="flex items-center gap-3">
                <input
                  id="accent-color"
                  type="color"
                  value={color}
                  disabled={!isAdmin}
                  onChange={(e) => setColor(e.target.value)}
                  className="h-10 w-14 shrink-0 cursor-pointer rounded-md border border-input bg-background p-1 disabled:cursor-not-allowed disabled:opacity-50"
                />
                <Input
                  value={color}
                  disabled={!isAdmin}
                  onChange={(e) => setColor(e.target.value)}
                  className="w-32 uppercase"
                  aria-label="Accent colour hex value"
                />
                <Button
                  onClick={() =>
                    runAction("color", () => updateAccentColor(color), "Colour updated.")
                  }
                  disabled={!isAdmin || busy === "color" || color === church?.accent_color}
                >
                  {busy === "color" ? "Saving..." : "Save"}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Your profile</CardTitle>
            <CardDescription>How your name appears to your team.</CardDescription>
          </CardHeader>
          <CardContent>
            <form className="flex flex-col gap-1.5" onSubmit={handleProfileSubmit}>
              <Label htmlFor="profile-name">Name</Label>
              <div className="flex gap-2">
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
            <CardTitle className="text-base">Sign-in details</CardTitle>
            <CardDescription>
              Changing your email sends a confirmation link to the new address.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-5">
            <form className="flex flex-col gap-1.5" onSubmit={handleEmailSubmit}>
              <Label htmlFor="account-email">Email</Label>
              <div className="flex gap-2">
                <Input
                  id="account-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
                <Button
                  type="submit"
                  disabled={busy === "email" || !email.trim() || email.trim() === currentEmail}
                >
                  {busy === "email" ? "Sending..." : "Update"}
                </Button>
              </div>
            </form>

            <form className="flex flex-col gap-1.5" onSubmit={handlePasswordSubmit}>
              <Label htmlFor="account-password">New password</Label>
              <div className="flex gap-2">
                <Input
                  id="account-password"
                  type="password"
                  autoComplete="new-password"
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="At least 6 characters"
                />
                <Button type="submit" disabled={busy === "password" || password.length < 6}>
                  {busy === "password" ? "Saving..." : "Update"}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Signed in with Google? Setting a password here lets you sign in
                either way.
              </p>
            </form>

            <div className="pt-1">
              <Button variant="outline" onClick={handleSignOut}>
                Sign out
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="border-destructive/40">
          <CardHeader>
            <CardTitle className="text-base text-destructive">Delete account</CardTitle>
            <CardDescription>
              {isAdmin
                ? "Deleting your account also deletes your church, its songs, and its worship sets. This can't be undone."
                : "This removes your account from this church. It can't be undone."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive">Delete my account</Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete your account?</AlertDialogTitle>
                  <AlertDialogDescription>
                    {isAdmin
                      ? `This permanently deletes your account and everything in ${church?.name ?? "your church"} — every song and worship set. This can't be undone.`
                      : "This permanently deletes your account. This can't be undone."}
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Keep my account</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleDelete}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    Delete everything
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
