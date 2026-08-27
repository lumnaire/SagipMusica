import { type ReactNode, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  Music2,
  ListMusic,
  Settings,
  LogOut,
  Menu,
  X,
  Tags,
  BookOpen,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/stores/auth-store";
import { useChurchStore } from "@/stores/church-store";
import { Button } from "@/components/ui/button";
import {
  Avatar,
  AvatarFallback,
} from "@/components/ui/avatar";
import sagipmusicaLogo from "@/assets/sagipmusica-logo1.png";

interface NavLocation {
  pathname: string;
  search: string;
}

interface NavItem {
  label: string;
  to: string;
  icon: React.ComponentType<{ className?: string }>;
  /** Anchor for the onboarding spotlight tour (see DashboardPage). */
  tourId?: string;
  /**
   * Overrides the default "pathname starts with `to`" active check.
   * Needed for items that share a pathname and differ only by query
   * string (e.g. Songs vs. Categories), so at most one of them is ever
   * highlighted as active at the same time.
   */
  isActive?: (location: NavLocation) => boolean;
}

interface NavSection {
  title: string | null;
  items: NavItem[];
}

function isCategoriesView(location: NavLocation) {
  return new URLSearchParams(location.search).get("view") === "categories";
}

const NAV: NavSection[] = [
  {
    title: null,
    items: [
      { label: "Dashboard", to: "/dashboard", icon: LayoutDashboard, tourId: "nav-dashboard" },
    ],
  },
  {
    title: "Hymnal",
    items: [
      {
        label: "Songs",
        to: "/songs",
        icon: Music2,
        tourId: "nav-songs",
        isActive: (loc) => loc.pathname.startsWith("/songs") && !isCategoriesView(loc),
      },
      {
        label: "Categories",
        to: "/songs?view=categories",
        icon: Tags,
        isActive: (loc) => loc.pathname === "/songs" && isCategoriesView(loc),
      },
    ],
  },
  {
    title: "Worship",
    items: [
      { label: "Worship Sets", to: "/sets", icon: ListMusic, tourId: "nav-sets" },
      { label: "Bible", to: "/bible", icon: BookOpen, tourId: "nav-bible" },
    ],
  },
  {
    title: null,
    items: [{ label: "Settings", to: "/settings", icon: Settings, tourId: "nav-settings" }],
  },
];

function isNavItemActive(item: NavItem, location: NavLocation): boolean {
  if (item.isActive) return item.isActive(location);
  const targetPathname = item.to.split("?")[0];
  return location.pathname === targetPathname || location.pathname.startsWith(`${targetPathname}/`);
}

function initialsFor(name: string | null, email: string | undefined) {
  if (name && name.trim().length > 0) {
    const parts = name.trim().split(/\s+/);
    return parts
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase())
      .join("");
  }
  return email?.[0]?.toUpperCase() ?? "?";
}

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const { profile, session, signOut } = useAuthStore();
  const church = useChurchStore((s) => s.church);
  const navigate = useNavigate();
  const location = useLocation();

  async function handleSignOut() {
    await signOut();
    navigate("/");
  }

  return (
    <div className="flex h-full flex-col bg-sidebar text-sidebar-foreground">
      <div className="flex items-center gap-2.5 px-5 py-5">
        <img src={sagipmusicaLogo} alt="" className="h-10 w-10 shrink-0 object-contain" />
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold leading-tight">
            {church?.name ?? "SagipMusica"}
          </p>
          <p className="text-xs text-sidebar-foreground/60">SagipMusica</p>
        </div>
      </div>

      <nav className="flex-1 space-y-6 overflow-y-auto px-3 py-2">
        {NAV.map((section, i) => (
          <div key={i}>
            {section.title && (
              <p className="px-3 pb-1.5 text-xs font-semibold uppercase tracking-wider text-sidebar-foreground/45">
                {section.title}
              </p>
            )}
            <div className="space-y-0.5">
              {section.items.map((item) => {
                const active = isNavItemActive(item, location);
                return (
                  <Link
                    key={item.label}
                    to={item.to}
                    onClick={onNavigate}
                    data-tour-id={item.tourId}
                    className={cn(
                      "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                      active
                        ? "bg-sidebar-accent text-sidebar-accent-foreground"
                        : "text-sidebar-foreground/75 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
                    )}
                  >
                    <item.icon className="h-4 w-4 shrink-0" />
                    {item.label}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className="border-t border-sidebar-border p-3">
        <div className="flex items-center gap-2.5 rounded-md px-2 py-2">
          <Avatar className="h-8 w-8">
            <AvatarFallback className="bg-sidebar-accent text-sidebar-accent-foreground text-xs">
              {initialsFor(profile?.name ?? null, session?.user.email)}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">
              {profile?.name || session?.user.email}
            </p>
            <p className="truncate text-xs capitalize text-sidebar-foreground/55">
              {profile?.role ?? "presenter"}
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
            onClick={handleSignOut}
            title="Sign out"
          >
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const church = useChurchStore((s) => s.church);

  return (
    <div className="flex min-h-svh bg-muted/30">
      {/* Desktop sidebar */}
      <aside className="hidden w-64 shrink-0 md:block">
        <div className="fixed h-svh w-64">
          <SidebarContent />
        </div>
      </aside>

      {/* Mobile sidebar */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setMobileOpen(false)}
          />
          <div className="absolute left-0 top-0 h-full w-64">
            <SidebarContent onNavigate={() => setMobileOpen(false)} />
          </div>
        </div>
      )}

      <div className="flex min-h-svh flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-border bg-background/95 px-4 backdrop-blur md:hidden">
          <Button variant="ghost" size="icon" onClick={() => setMobileOpen(true)}>
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>
          <img src={sagipmusicaLogo} alt="" className="h-7 w-7 object-contain" />
          <p className="truncate text-sm font-semibold">{church?.name ?? "SagipMusica"}</p>
        </header>
        <main className="flex-1 p-4 md:p-8">{children}</main>
      </div>
    </div>
  );
}
