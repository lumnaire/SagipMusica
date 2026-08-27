import { Link } from "react-router-dom";
import { ArrowRight, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { LATEST_RELEASE } from "../releases";

interface ReleaseAnnouncementProps {
  /**
   * "dark" sits on the hero video and the download page's dark banner;
   * "light" sits on an ivory section. The two heroes this appears in have
   * opposite backgrounds, and a single translucent-white treatment is
   * invisible on one of them.
   */
  tone?: "dark" | "light";
  className?: string;
}

/**
 * "Version 1.2.1 is out" — the pill that takes people to /releases.
 *
 * A badge in the hero rather than a bar pinned above the page. The marketing
 * nav is `fixed`, so a top bar would have to push it down and every hero
 * offset with it; and a release is news worth announcing, not an alert worth
 * interrupting for. This is the shape the announcement takes on most software
 * sites for exactly that reason.
 *
 * Not dismissible, and deliberately so: there is no nagging to escape from.
 * It is one line in the hero that changes when there is genuinely something
 * new, and hiding it behind a per-browser dismissal would only mean the next
 * release went unannounced to everyone who had clicked the X on this one.
 *
 * The version it names comes from RELEASES, so this needs no edit when a
 * build ships.
 */
export function ReleaseAnnouncement({ tone = "dark", className }: ReleaseAnnouncementProps) {
  return (
    <Link
      to="/releases"
      className={cn(
        "group inline-flex max-w-full items-center gap-2 rounded-full border py-1.5 pl-3 pr-2.5 text-xs font-medium transition-colors",
        tone === "dark"
          ? "border-white/20 bg-white/10 text-white/90 hover:border-white/35 hover:bg-white/15"
          : "border-accent/30 bg-accent/10 text-foreground hover:border-accent/50 hover:bg-accent/15",
        className,
      )}
    >
      <span
        className={cn(
          "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[0.6875rem] font-semibold uppercase tracking-wide",
          tone === "dark" ? "bg-white/15 text-white" : "bg-accent/20 text-accent-foreground",
        )}
      >
        <Sparkles className="h-3 w-3" />
        New
      </span>

      {/* The version is the news; the invitation is what makes it a link.
          Below `sm` only the first half survives -- "Version 1.2.1 is out" is
          the part that carries the meaning on a phone. */}
      <span className="truncate">
        Version {LATEST_RELEASE.version} is out
        <span className="hidden sm:inline"> — see what's new</span>
      </span>

      <ArrowRight className="h-3.5 w-3.5 shrink-0 transition-transform group-hover:translate-x-0.5" />
    </Link>
  );
}
