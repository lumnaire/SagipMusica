import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
  Users,
  Church,
  Music2,
  ListMusic,
  Radio,
  RefreshCw,
  Trash2,
  LogOut,
  ShieldCheck,
  Library,
  UserCog,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useAuthStore } from "@/stores/auth-store";
import { subscribeToPresence, type PresenceStatus } from "@/lib/presence";
import {
  deletePlatformAccount,
  fetchPlatformAccounts,
  fetchPlatformStats,
  setAccountRole,
  type AssignableRole,
  type PlatformAccount,
  type PlatformStats,
} from "@/features/superadmin/api";
import sagipmusicaLogo from "@/assets/sagipmusica-logo.png";

export function SuperAdminPage() {
  const { profile, signOut } = useAuthStore();
  const navigate = useNavigate();

  const [stats, setStats] = useState<PlatformStats | null>(null);
  const [accounts, setAccounts] = useState<PlatformAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [onlineCount, setOnlineCount] = useState(0);
  const [presenceStatus, setPresenceStatus] = useState<PresenceStatus>("idle");
  const [pendingDelete, setPendingDelete] = useState<PlatformAccount | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [pendingRole, setPendingRole] = useState<{
    account: PlatformAccount;
    role: AssignableRole;
  } | null>(null);
  const [changingRole, setChangingRole] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [s, a] = await Promise.all([fetchPlatformStats(), fetchPlatformAccounts()]);
      setStats(s);
      setAccounts(a);
    } catch (err) {
      console.error(err);
      toast.error(err instanceof Error ? err.message : "Couldn't load platform data.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // Live count from the shared presence channel (see src/lib/presence.ts).
  useEffect(
    () =>
      subscribeToPresence(({ count, status }) => {
        setOnlineCount(count);
        setPresenceStatus(status);
      }),
    [],
  );

  async function handleSignOut() {
    await signOut();
    navigate("/");
  }

  async function handleDelete() {
    if (!pendingDelete) return;
    setDeleting(true);
    try {
      await deletePlatformAccount(pendingDelete.id);
      toast.success(`${pendingDelete.email} deleted.`);
      setPendingDelete(null);
      await load();
    } catch (err) {
      console.error(err);
      toast.error(err instanceof Error ? err.message : "Couldn't delete that account.");
    } finally {
      setDeleting(false);
    }
  }

  async function handleRoleChange() {
    if (!pendingRole) return;
    setChangingRole(true);
    try {
      await setAccountRole(pendingRole.account.id, pendingRole.role);
      toast.success(
        pendingRole.role === "encoder"
          ? `${pendingRole.account.email} is now a song encoder.`
          : `${pendingRole.account.email} is no longer a song encoder.`,
      );
      setPendingRole(null);
      await load();
    } catch (err) {
      console.error(err);
      toast.error(err instanceof Error ? err.message : "Couldn't change that role.");
    } finally {
      setChangingRole(false);
    }
  }

  const filtered = accounts.filter((a) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      a.email.toLowerCase().includes(q) ||
      (a.name ?? "").toLowerCase().includes(q) ||
      (a.church_name ?? "").toLowerCase().includes(q)
    );
  });

  return (
    <div className="min-h-svh bg-muted/30">
      <header className="border-b border-border bg-background">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <img src={sagipmusicaLogo} alt="" className="h-9 w-9 shrink-0 object-contain" />
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="font-display text-xl text-foreground">Platform</h1>
                <Badge variant="secondary" className="gap-1">
                  <ShieldCheck className="h-3 w-3" />
                  Superadmin
                </Badge>
              </div>
              <p className="truncate text-xs text-muted-foreground">{profile?.email}</p>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
              <RefreshCw className={loading ? "h-4 w-4 animate-spin" : "h-4 w-4"} />
              Refresh
            </Button>
            <Button variant="outline" size="sm" onClick={handleSignOut}>
              <LogOut className="h-4 w-4" />
              Sign out
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
        <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-6">
          <StatCard icon={Users} label="Accounts" value={stats?.total_accounts} loading={loading} />
          <StatCard icon={Church} label="Churches" value={stats?.total_churches} loading={loading} />
          <StatCard icon={Music2} label="Songs" value={stats?.total_songs} loading={loading} />
          <StatCard
            icon={ListMusic}
            label="Worship sets"
            value={stats?.total_worship_sets}
            loading={loading}
          />
          <StatCard
            icon={Library}
            label="Library songs"
            value={stats?.total_library_songs}
            loading={loading}
          />
          <StatCard
            icon={Radio}
            label="Online now"
            value={onlineCount}
            loading={false}
            live={presenceStatus === "live"}
            note={
              presenceStatus === "live"
                ? "distinct people"
                : presenceStatus === "connecting"
                  ? "Connecting..."
                  : presenceStatus === "error"
                    ? "Realtime unavailable"
                    : "Not connected"
            }
          />
        </div>

        <section className="mt-8">
          <div className="mb-4 flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
            <div>
              <h2 className="font-display text-xl text-foreground">Accounts</h2>
              <p className="text-sm text-muted-foreground">
                Every account on the platform. Deleting one is permanent.
              </p>
            </div>
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search email, name, or church..."
              className="sm:w-72"
            />
          </div>

          <p className="mb-4 rounded-md border border-border bg-card px-3 py-2 text-xs text-muted-foreground">
            <strong className="text-foreground">Adding a song encoder:</strong> have them sign up
            and verify their email, but <strong>stop before onboarding</strong> — an encoder must
            not create a church. A <em>Make encoder</em> button then appears on their row below.
            Accounts that already own a church can't become encoders, because demoting them would
            leave that church with nobody able to edit its songs.
          </p>

          {loading ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-14 w-full" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <p className="rounded-md border border-dashed border-border bg-muted/30 px-4 py-10 text-center text-sm text-muted-foreground">
              {accounts.length === 0 ? "No accounts yet." : "No accounts match your search."}
            </p>
          ) : (
            <div className="overflow-hidden rounded-lg border border-border bg-card">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Account</TableHead>
                    <TableHead className="hidden md:table-cell">Church</TableHead>
                    <TableHead className="hidden lg:table-cell">Role</TableHead>
                    <TableHead className="hidden xl:table-cell">Joined</TableHead>
                    <TableHead className="hidden lg:table-cell">Last sign-in</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((account) => {
                    const isSelf = account.id === profile?.id;
                    const isSuper = account.role === "superadmin";
                    const isEncoder = account.role === "encoder";
                    // Mirrors superadmin_set_role's guards, so the button is
                    // only offered where the function would actually succeed.
                    const canChangeRole = !isSelf && !isSuper && !account.church_id;
                    return (
                      <TableRow key={account.id}>
                        <TableCell>
                          <div className="min-w-0">
                            <span className="block truncate font-medium text-foreground">
                              {account.name || "—"}
                            </span>
                            <span className="block truncate text-xs text-muted-foreground">
                              {account.email}
                            </span>
                            {!account.email_confirmed_at && (
                              <Badge variant="outline" className="mt-1 text-[10px]">
                                Unverified
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="hidden text-muted-foreground md:table-cell">
                          {account.church_name || "—"}
                        </TableCell>
                        <TableCell className="hidden lg:table-cell">
                          <Badge variant={isSuper ? "default" : "secondary"} className="capitalize">
                            {account.role}
                          </Badge>
                        </TableCell>
                        <TableCell className="hidden whitespace-nowrap text-muted-foreground xl:table-cell">
                          {formatDistanceToNow(new Date(account.created_at), { addSuffix: true })}
                        </TableCell>
                        <TableCell className="hidden whitespace-nowrap text-muted-foreground lg:table-cell">
                          {account.last_sign_in_at
                            ? formatDistanceToNow(new Date(account.last_sign_in_at), {
                                addSuffix: true,
                              })
                            : "Never"}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            {/* Rendered only where it would actually succeed. A
                                permanently-disabled icon here read as "missing
                                feature" rather than "not eligible". */}
                            {canChangeRole && (
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-8 whitespace-nowrap"
                                onClick={() =>
                                  setPendingRole({
                                    account,
                                    role: isEncoder ? "presenter" : "encoder",
                                  })
                                }
                              >
                                <UserCog className="h-4 w-4" />
                                {isEncoder ? "Remove encoder" : "Make encoder"}
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-destructive hover:text-destructive"
                              title={
                                isSelf
                                  ? "You can't delete your own account here"
                                  : isSuper
                                    ? "Superadmin accounts can't be deleted here"
                                    : "Delete account"
                              }
                              disabled={isSelf || isSuper}
                              onClick={() => setPendingDelete(account)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}

          {!loading && filtered.length > 0 && (
            <p className="mt-3 text-sm text-muted-foreground">
              Showing {filtered.length} of {accounts.length} account
              {accounts.length === 1 ? "" : "s"}
            </p>
          )}
        </section>
      </main>

      <AlertDialog
        open={!!pendingRole}
        onOpenChange={(open) => !open && !changingRole && setPendingRole(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {pendingRole?.role === "encoder"
                ? "Make this account a song encoder?"
                : "Remove encoder access?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {pendingRole?.role === "encoder" ? (
                <>
                  <strong>{pendingRole?.account.email}</strong> will be able to add and publish
                  songs to the shared library that every church can draw from. They will not be
                  able to see or edit any church's own songs.
                </>
              ) : (
                <>
                  <strong>{pendingRole?.account.email}</strong> will lose access to the library
                  editor. Songs they already published stay in the library.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={changingRole}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                void handleRoleChange();
              }}
              disabled={changingRole}
            >
              {changingRole
                ? "Saving..."
                : pendingRole?.role === "encoder"
                  ? "Make encoder"
                  : "Remove access"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={!!pendingDelete}
        onOpenChange={(open) => !open && !deleting && setPendingDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this account?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently deletes <strong>{pendingDelete?.email}</strong>.
              {pendingDelete?.church_name
                ? ` If they are the last member of ${pendingDelete.church_name}, that church and all its songs and worship sets are deleted too.`
                : ""}{" "}
              This can't be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                void handleDelete();
              }}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? "Deleting..." : "Delete account"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  loading,
  live,
  note,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number | undefined;
  loading: boolean;
  live?: boolean;
  note?: string;
}) {
  // A dash rather than 0 when the channel isn't live: "nobody online" and
  // "not connected" must not look the same.
  const disconnected = note !== undefined && note !== "distinct people";
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between gap-2 space-y-0 pb-2">
        <CardTitle className="text-xs font-medium text-muted-foreground sm:text-sm">
          {label}
        </CardTitle>
        {live ? (
          <span className="relative flex h-2 w-2 shrink-0" aria-hidden="true">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-success" />
          </span>
        ) : (
          <Icon className="h-4 w-4 shrink-0 text-primary" />
        )}
      </CardHeader>
      <CardContent>
        {loading ? (
          <Skeleton className="h-8 w-16" />
        ) : (
          <p className="text-2xl font-semibold text-foreground sm:text-3xl">
            {disconnected ? "—" : (value ?? 0)}
          </p>
        )}
        {note && <p className="mt-1 text-[11px] text-muted-foreground">{note}</p>}
      </CardContent>
    </Card>
  );
}
