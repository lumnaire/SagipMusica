import { useEffect } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  CheckCircle2,
  Download,
  ExternalLink,
  History,
  ShieldCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Reveal } from "@/components/ui/reveal";
import { WindowsIcon } from "@/components/icons/platform-icons";
import { MarketingNav } from "@/features/marketing/components/MarketingNav";
import { MarketingFooter } from "@/features/marketing/components/MarketingFooter";
import { DownloadDialog } from "./DownloadDialog";
import {
  LATEST_RELEASE,
  PREVIOUS_RELEASES,
  RELEASES,
  formatReleaseDate,
  installerUrl,
  releaseNotesUrl,
  type Release,
} from "../releases";

/**
 * Every version of the desktop app, and where to get it.
 *
 * Shaped like a conventional releases page, because the people who go looking
 * for one already know what they expect to find: the current build stated
 * plainly at the top with a single obvious button, then the full history in a
 * table underneath.
 *
 * Older builds stay downloadable. A church mid-service on a Sunday that has
 * just hit a bug in the newest version needs a way back to the one that
 * worked, and "reinstall the previous version" is a far better answer than
 * "wait for a patch". They are listed plainly rather than hidden behind a
 * disclosure, but only the current one gets the recommendation, the accent
 * border and the filled button — the visual weight is the recommendation.
 */
export function ReleasesPage() {
  useEffect(() => {
    document.title = "Releases · SagipMusica";
  }, []);

  return (
    <div className="min-h-svh bg-background">
      <MarketingNav solid />

      {/* ── Header ───────────────────────────────────────────────────── */}
      <section className="border-b border-border bg-sidebar pb-14 pt-28 text-white sm:pb-16 sm:pt-32">
        <div className="mx-auto max-w-5xl px-6">
          <Reveal>
            <span className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3.5 py-1.5 text-xs font-medium text-white/90">
              <History className="h-3.5 w-3.5" />
              Release history
            </span>

            <h1 className="mt-6 font-display text-3xl leading-tight sm:text-5xl">
              Every version of SagipMusica
            </h1>

            <p className="mt-4 max-w-2xl text-base leading-relaxed text-white/70">
              What changed in each build of the Windows app, and where to
              download it. We keep the older installers up — if a new version
              ever gets in your way on a Sunday, you can go back.
            </p>
          </Reveal>
        </div>
      </section>

      {/* ── Current release ──────────────────────────────────────────── */}
      <section className="border-b border-border bg-secondary/40 py-12 sm:py-16">
        <div className="mx-auto max-w-5xl px-6">
          <Reveal>
            <div className="rounded-2xl border-2 border-accent/40 bg-card p-6 shadow-sm sm:p-8">
              <div className="flex flex-wrap items-center gap-2.5">
                <Badge className="gap-1.5">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Recommended
                </Badge>
                <Badge variant="secondary">Latest</Badge>
              </div>

              <div className="mt-4 flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <h2 className="font-display text-3xl text-foreground sm:text-4xl">
                  Version {LATEST_RELEASE.version}
                </h2>
                <p className="text-sm text-muted-foreground">
                  <time dateTime={LATEST_RELEASE.date}>
                    {formatReleaseDate(LATEST_RELEASE.date)}
                  </time>
                  {" · "}
                  {LATEST_RELEASE.size}
                  {" · "}
                  Windows 10 &amp; 11 (64-bit)
                </p>
              </div>

              <p className="mt-3 text-base leading-relaxed text-foreground/90">
                {LATEST_RELEASE.summary}
              </p>

              <ul className="mt-5 space-y-2.5">
                {LATEST_RELEASE.highlights.map((line) => (
                  <li key={line} className="flex gap-2.5 text-sm leading-relaxed text-muted-foreground">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-accent-foreground/70" />
                    <span>{line}</span>
                  </li>
                ))}
              </ul>

              <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:items-center">
                {/* The same dialog the download page uses, so the install
                    walkthrough and the SmartScreen warning are explained once
                    and in one place. */}
                <DownloadDialog>
                  <Button size="lg" className="gap-2.5">
                    <Download className="h-5 w-5" />
                    Download {LATEST_RELEASE.version} for Windows
                  </Button>
                </DownloadDialog>

                <Button asChild variant="ghost" className="sm:ml-1">
                  <a href={releaseNotesUrl(LATEST_RELEASE)} target="_blank" rel="noreferrer">
                    Full notes on GitHub
                    <ExternalLink className="h-3.5 w-3.5 opacity-70" />
                  </a>
                </Button>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── The table ────────────────────────────────────────────────── */}
      <section className="py-12 sm:py-16">
        <div className="mx-auto max-w-5xl px-6">
          <Reveal>
            <h2 className="font-display text-2xl text-foreground">All releases</h2>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
              Newest first. Every installer below is the same file name —
              <code className="mx-1 rounded bg-muted px-1.5 py-0.5 text-xs">
                SagipMusica-Setup.exe
              </code>
              — and installs for your user only, so Windows never asks for an
              administrator password.
            </p>
          </Reveal>

          <Reveal delay={0.08}>
            {/* Wide content: the table scrolls inside its own box rather than
                making the page scroll sideways on a phone. */}
            <div className="mt-6 overflow-x-auto rounded-xl border border-border bg-card">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-[9rem]">Version</TableHead>
                    <TableHead className="min-w-[9rem]">Released</TableHead>
                    <TableHead className="min-w-[5rem]">Size</TableHead>
                    <TableHead className="min-w-[22rem]">What changed</TableHead>
                    <TableHead className="min-w-[11rem] text-right">Download</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {RELEASES.map((release) => (
                    <ReleaseRow key={release.version} release={release} />
                  ))}
                </TableBody>
              </Table>
            </div>
          </Reveal>

          {PREVIOUS_RELEASES.length > 0 && (
            <Reveal delay={0.12}>
              <div className="mt-6 flex gap-3 rounded-xl border border-border bg-muted/40 p-5">
                <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium text-foreground">
                    Install an older version only if you need to
                  </p>
                  <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                    Older builds are kept up so you are never stuck, but they do
                    not get fixes. Installing one over a newer version leaves
                    your songs and worship sets alone — they live in a separate
                    file on your computer, not in the app itself — though
                    anything added by a later version, like the built-in Bible,
                    goes away until you upgrade again.
                  </p>
                </div>
              </div>
            </Reveal>
          )}
        </div>
      </section>

      {/* ── Back to the download page ────────────────────────────────── */}
      <section className="border-t border-border bg-secondary/40 py-12">
        <div className="mx-auto max-w-5xl px-6">
          <div className="flex flex-col items-start justify-between gap-5 sm:flex-row sm:items-center">
            <div>
              <h2 className="font-display text-xl text-foreground">
                New to SagipMusica?
              </h2>
              <p className="mt-1.5 text-sm text-muted-foreground">
                The download page walks through what comes with it and how to
                install it.
              </p>
            </div>
            <Button asChild variant="outline" className="shrink-0">
              <Link to="/download">
                <WindowsIcon className="h-4 w-4" />
                Go to the download page
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      </section>

      <MarketingFooter />
    </div>
  );
}

function ReleaseRow({ release }: { release: Release }) {
  const isLatest = release === LATEST_RELEASE;

  return (
    <TableRow className={isLatest ? "bg-accent/5 hover:bg-accent/10" : undefined}>
      <TableCell className="align-top">
        <div className="flex flex-col gap-1.5">
          <span className="font-semibold text-foreground">{release.version}</span>
          {isLatest && (
            <Badge className="w-fit gap-1 text-[0.6875rem]">
              <CheckCircle2 className="h-3 w-3" />
              Recommended
            </Badge>
          )}
        </div>
      </TableCell>

      <TableCell className="align-top text-muted-foreground">
        <time dateTime={release.date}>{formatReleaseDate(release.date)}</time>
      </TableCell>

      <TableCell className="align-top tabular-nums text-muted-foreground">
        {release.size}
      </TableCell>

      <TableCell className="align-top">
        <ul className="space-y-1.5">
          {release.highlights.map((line) => (
            <li key={line} className="flex gap-2 text-sm leading-relaxed text-muted-foreground">
              <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-muted-foreground/50" />
              <span>{line}</span>
            </li>
          ))}
        </ul>
        <a
          href={releaseNotesUrl(release)}
          target="_blank"
          rel="noreferrer"
          className="mt-2.5 inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
        >
          Release notes
          <ExternalLink className="h-3 w-3" />
        </a>
      </TableCell>

      <TableCell className="align-top text-right">
        {isLatest ? (
          <DownloadDialog>
            <Button size="sm" className="gap-2">
              <Download className="h-4 w-4" />
              Download
            </Button>
          </DownloadDialog>
        ) : (
          // A plain link, not the dialog: the walkthrough it shows describes
          // the current build, and someone deliberately reaching for an older
          // one has installed this before.
          <Button asChild size="sm" variant="outline" className="gap-2">
            <a href={installerUrl(release)}>
              <Download className="h-4 w-4" />
              Download
            </a>
          </Button>
        )}
      </TableCell>
    </TableRow>
  );
}
