import { type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { LogOut, Library } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuthStore } from "@/stores/auth-store";
import sagipmusicaLogo from "@/assets/sagipmusica-logo1.png";

/**
 * Chrome for the encoder area. Deliberately not AppShell: that shell is built
 * around a church — its nav points at /songs, /sets and /settings, and it shows
 * the church's name and accent colour. An encoder has no church, so none of it
 * would resolve.
 */
export function EncoderShell({
  children,
  actions,
}: {
  children: ReactNode;
  actions?: ReactNode;
}) {
  const { profile, signOut } = useAuthStore();
  const navigate = useNavigate();

  async function handleSignOut() {
    await signOut();
    navigate("/");
  }

  return (
    <div className="min-h-svh bg-muted/30">
      <header className="border-b border-border bg-background">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <button
            type="button"
            onClick={() => navigate("/encoder")}
            className="flex min-w-0 items-center gap-3 text-left"
          >
            <img src={sagipmusicaLogo} alt="" className="h-9 w-9 shrink-0 object-contain" />
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="font-display text-xl text-foreground">Song Library</h1>
                <Badge variant="secondary" className="gap-1">
                  <Library className="h-3 w-3" />
                  Encoder
                </Badge>
              </div>
              <p className="truncate text-xs text-muted-foreground">{profile?.email}</p>
            </div>
          </button>

          <div className="flex flex-wrap items-center gap-2 sm:shrink-0">
            {actions}
            <Button variant="outline" size="sm" onClick={handleSignOut}>
              <LogOut className="h-4 w-4" />
              Sign out
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">{children}</main>
    </div>
  );
}
