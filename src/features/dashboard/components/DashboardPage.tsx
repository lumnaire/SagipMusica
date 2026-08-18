import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Music2, ListMusic, BookOpen, Sparkles, Plus, PlayCircle } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/lib/supabase/client";
import { useAuthStore } from "@/stores/auth-store";
import type { Song } from "@/types/database";

interface DashboardStats {
  totalSongs: number;
  totalHymns: number;
  totalSets: number;
  recentSongs: Song[];
}

function useDashboardStats() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [songsCount, hymnsCount, setsCount, recent] = await Promise.all([
        supabase.from("songs").select("*", { count: "exact", head: true }),
        supabase
          .from("songs")
          .select("*", { count: "exact", head: true })
          .eq("category", "Hymn"),
        supabase.from("worship_sets").select("*", { count: "exact", head: true }),
        supabase.from("songs").select("*").order("created_at", { ascending: false }).limit(5),
      ]);

      if (cancelled) return;
      setStats({
        totalSongs: songsCount.count ?? 0,
        totalHymns: hymnsCount.count ?? 0,
        totalSets: setsCount.count ?? 0,
        recentSongs: (recent.data ?? []) as Song[],
      });
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return { stats, loading };
}

export function DashboardPage() {
  const { profile } = useAuthStore();
  const { stats, loading } = useDashboardStats();
  const navigate = useNavigate();

  const firstName = profile?.name?.split(" ")[0];
  const isAdmin = profile?.role === "admin";

  return (
    <AppShell>
      <div className="mx-auto max-w-6xl">
        <div className="mb-8">
          <h1 className="text-2xl font-semibold text-foreground">
            {firstName ? `Welcome back, ${firstName}` : "Welcome back"}
          </h1>
          <p className="text-sm text-muted-foreground">
            Here's what's happening with your church's worship planning.
          </p>
        </div>

        <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            icon={Music2}
            label="Total Songs"
            value={stats?.totalSongs}
            loading={loading}
          />
          <StatCard
            icon={BookOpen}
            label="Total Hymns"
            value={stats?.totalHymns}
            loading={loading}
          />
          <StatCard
            icon={ListMusic}
            label="Worship Sets"
            value={stats?.totalSets}
            loading={loading}
          />
          <StatCard
            icon={Sparkles}
            label="Recently Added"
            value={stats?.recentSongs.length}
            loading={loading}
          />
        </div>

        <div className="mb-8">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Quick Actions
          </h2>
          <div className="flex flex-wrap gap-3">
            {isAdmin && (
              <Button onClick={() => navigate("/songs/new")}>
                <Plus className="h-4 w-4" />
                Add Song
              </Button>
            )}
            <Button variant="outline" onClick={() => navigate("/sets/new")}>
              <Plus className="h-4 w-4" />
              Create Worship Set
            </Button>
            <Button variant="outline" onClick={() => navigate("/sets")}>
              <PlayCircle className="h-4 w-4" />
              Start Presentation
            </Button>
          </div>
        </div>

        <div>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Recent Songs
          </h2>
          <Card>
            <CardContent className="p-0">
              {loading ? (
                <div className="space-y-2 p-4">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : stats && stats.recentSongs.length > 0 ? (
                <ul className="divide-y divide-border">
                  {stats.recentSongs.map((song) => (
                    <li key={song.id}>
                      <button
                        type="button"
                        onClick={() => navigate(`/songs/${song.id}`)}
                        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/50"
                      >
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                            <Music2 className="h-4 w-4" />
                          </div>
                          <div>
                            <p className="text-sm font-medium text-foreground">{song.title}</p>
                            <p className="text-xs text-muted-foreground">
                              {song.author || "Unknown author"}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {song.category && <Badge variant="secondary">{song.category}</Badge>}
                          <span className="text-xs text-muted-foreground">
                            {formatDistanceToNow(new Date(song.created_at), { addSuffix: true })}
                          </span>
                        </div>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="flex flex-col items-center gap-3 px-4 py-12 text-center">
                  <p className="text-sm text-muted-foreground">
                    {isAdmin
                      ? "No songs yet. Build your church hymnal by adding your first song."
                      : "No songs yet. Ask an admin to add songs to the hymnal."}
                  </p>
                  {isAdmin && (
                    <Button size="sm" onClick={() => navigate("/songs/new")}>
                      <Plus className="h-4 w-4" />
                      Add Song
                    </Button>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </AppShell>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  loading,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number | undefined;
  loading: boolean;
}) {
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
        <Icon className="h-4 w-4 text-primary" />
      </CardHeader>
      <CardContent>
        {loading ? (
          <Skeleton className="h-8 w-16" />
        ) : (
          <p className="text-3xl font-semibold text-foreground">{value ?? 0}</p>
        )}
      </CardContent>
    </Card>
  );
}
