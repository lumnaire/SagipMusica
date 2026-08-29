import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Music2, ListMusic, BookOpen, Library, Sparkles, Plus, PlayCircle } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { useAuthStore } from "@/stores/auth-store";
import { useChurchStore } from "@/stores/church-store";
import {
  fetchDashboardStats,
  markOnboardingComplete,
  type DashboardStats,
} from "@/features/dashboard/api";
import { EventBanner } from "@/features/event/components/EventBanner";
import { EventDialog, EventQuickAction } from "@/features/event/components/EventDialog";
import { useEventStore } from "@/features/event/store";
import { WelcomeDialog } from "./WelcomeDialog";
// Imported outright, not with await import().
//
// It used to be loaded on demand to keep it out of the main bundle, and that
// put an async gap between "this account needs the walkthrough" and the
// walkthrough existing. Anything that went wrong in that gap -- a rejected
// chunk request, an unmount landing in the middle of it -- failed silently and
// permanently: no error on screen, no tour, and a ref already flipped so it
// would not try again. Seven kilobytes gzipped is not worth a first-run
// experience that can vanish without trace.
import { driver } from "driver.js";
import "driver.js/dist/driver.css";

/**
 * Whether a tour anchor is genuinely on screen, not merely in the DOM.
 *
 * Five of the walkthrough's steps point into the sidebar, which is
 * `hidden md:block` — present in the document at every width, and
 * `display: none` below 768px. querySelector finds it either way, so a tour
 * built without this check spends most of its steps highlighting a box with no
 * size: popovers land off-screen or not at all, and the walkthrough looks like
 * it simply never ran. It then marks the account onboarded on the way out, so
 * it never gets a second chance.
 *
 * Computed style rather than getBoundingClientRect, deliberately: it gives the
 * same answer in a browser and in jsdom, where there is no layout to measure
 * but stylesheets are not applied either, so nothing is hidden unless a test
 * says so.
 */
function isOnScreen(selector: string): boolean {
  const element = document.querySelector(selector);
  if (!element) return false;

  for (let node: Element | null = element; node; node = node.parentElement) {
    const style = window.getComputedStyle(node);
    if (style.display === "none" || style.visibility === "hidden") return false;
  }
  return true;
}

function useDashboardStats() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const next = await fetchDashboardStats();
      if (cancelled) return;
      setStats(next);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return { stats, loading };
}

export function DashboardPage() {
  const { profile, refreshProfile } = useAuthStore();
  const church = useChurchStore((s) => s.church);
  const { stats, loading } = useDashboardStats();
  const navigate = useNavigate();
  const tourStarted = useRef(false);
  const [showWelcome, setShowWelcome] = useState(false);
  const [eventOpen, setEventOpen] = useState(false);

  const loadEvent = useEventStore((s) => s.load);

  // Nothing else on this page fetches the event now that the board is behind a
  // button.
  useEffect(() => {
    void loadEvent();
  }, [loadEvent]);

  const firstName = profile?.name?.split(" ")[0];
  const isAdmin = profile?.role === "admin";

  useEffect(() => {
    if (tourStarted.current || !profile || profile.onboarding_completed) return;
    tourStarted.current = true;

    const finish = async () => {
      // Land on the welcome note once the tour is done (or skipped), so the
      // first thing they see after the walkthrough is that the hymnal is
      // already stocked.
      setShowWelcome(true);
      await markOnboardingComplete(profile.id);
      await refreshProfile();
    };

    const allSteps = [
      {
        element: '[data-tour-id="nav-dashboard"]',
        popover: {
          title: "Your dashboard",
          description: "A quick overview of your church's songs and worship sets.",
        },
      },
      {
        element: '[data-tour-id="nav-songs"]',
        popover: {
          title: "Songs",
          description: "Build your church's hymnal here — lyrics, sections, and more.",
        },
      },
      {
        element: '[data-tour-id="nav-sets"]',
        popover: {
          title: "Worship Sets",
          description: "Put together a service order and present it live.",
        },
      },
      {
        element: '[data-tour-id="nav-bible"]',
        popover: {
          title: "The Bible is built in",
          description:
            "The whole King James Version, already here — no add-on, no internet needed to read it. Type a reference like John 3:16, or search for the words you remember, and put it straight on the screen.",
        },
      },
      {
        element: '[data-tour-id="nav-settings"]',
        popover: {
          title: "Settings",
          description: "Customize your church's accent color and manage your account.",
        },
      },
      {
        element: '[data-tour-id="quick-actions"]',
        popover: {
          title: "Quick actions",
          description: "Jump straight into adding a song or building a worship set.",
        },
      },
      {
        element: '[data-tour-id="recent-songs"]',
        popover: {
          title: "Recent songs",
          description: "Your most recently added songs show up here.",
        },
      },
    ];

    // Steps whose anchor is off screen are dropped rather than highlighted
    // into a void -- five of these live in the sidebar, which is `display:
    // none` below 768px (see isOnScreen). On a phone that leaves the steps
    // that live in the page itself, which is the right walkthrough for a
    // screen with no sidebar on it.
    //
    // If that filter somehow leaves nothing, the unfiltered list is used
    // anyway. The filter is an improvement, not a gate: a walkthrough that
    // declines to run is indistinguishable from one that is broken, and this
    // is a first run that only ever happens once.
    const visible = allSteps.filter((step) => isOnScreen(step.element));
    const steps = visible.length > 0 ? visible : allSteps;

    try {
      driver({ showProgress: true, onDestroyed: finish, steps }).drive();
    } catch (err) {
      // Loud, and retryable on the next load. Silence here is what made this
      // impossible to diagnose from the outside.
      console.error("The onboarding walkthrough could not start", err);
      tourStarted.current = false;
    }
  }, [profile, refreshProfile]);

  return (
    <AppShell>
      <div className="mx-auto max-w-6xl 2xl:max-w-7xl">
        <EventBanner />

        <div className="mb-6 sm:mb-8">
          <h1 className="font-display text-2xl text-foreground sm:text-3xl">
            {firstName ? `Welcome back, ${firstName}` : "Welcome back"}
          </h1>
          <p className="text-sm text-muted-foreground">
            Here's what's happening with your church's worship planning.
          </p>
        </div>

        {/* Two-up on phones: these tiles are small, and one per row would
            push the real content below the fold. */}
        <div className="mb-8 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          <StatCard
            icon={Music2}
            label="Total Songs"
            value={stats?.totalSongs}
            loading={loading}
          />
          <StatCard
            icon={Library}
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
          <div className="flex flex-wrap gap-3" data-tour-id="quick-actions">
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
            <Button variant="outline" onClick={() => navigate("/bible")}>
              <BookOpen className="h-4 w-4" />
              Open the Bible
            </Button>
            {/* Last in the row, and gone entirely once the event closes. */}
            <EventQuickAction onOpen={() => setEventOpen(true)} />
          </div>
        </div>

        <div>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Recent Songs
          </h2>
          <Card data-tour-id="recent-songs">
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

      <WelcomeDialog
        open={showWelcome}
        onOpenChange={setShowWelcome}
        churchName={church?.name ?? null}
        songCount={stats?.totalSongs ?? 0}
      />

      <EventDialog open={eventOpen} onOpenChange={setEventOpen} />


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
      <CardHeader className="flex-row items-center justify-between gap-2 space-y-0 pb-2">
        <CardTitle className="text-xs font-medium text-muted-foreground sm:text-sm">
          {label}
        </CardTitle>
        <Icon className="h-4 w-4 shrink-0 text-primary" />
      </CardHeader>
      <CardContent>
        {loading ? (
          <Skeleton className="h-8 w-16" />
        ) : (
          <p className="text-2xl font-semibold text-foreground sm:text-3xl">{value ?? 0}</p>
        )}
      </CardContent>
    </Card>
  );
}
