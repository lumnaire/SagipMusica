import { useEffect } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  Download,
  Heart,
  History,
  Library,
  ListMusic,
  MessageCircle,
  MonitorPlay,
  Save,
  ShieldCheck,
  Sparkles,
  WifiOff,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Reveal } from "@/components/ui/reveal";
import { WindowsIcon, AppleIcon } from "@/components/icons/platform-icons";
import { MarketingNav } from "@/features/marketing/components/MarketingNav";
import { MarketingFooter } from "@/features/marketing/components/MarketingFooter";
import { SupportDialog } from "@/features/marketing/components/SupportDialog";
import { DownloadDialog } from "./DownloadDialog";
import { ReleaseAnnouncement } from "./ReleaseAnnouncement";
import { UpcomingUpdates } from "./UpcomingUpdates";
import {
  DESKTOP_RELEASED,
  DESKTOP_SIZE,
  DESKTOP_VERSION,
  FACEBOOK_URL,
  INSTALL_STEPS,
  LIBRARY_CATEGORY_COUNT,
  LIBRARY_SONG_COUNT,
} from "../download-info";

const FEATURES = [
  {
    icon: Library,
    title: `${LIBRARY_SONG_COUNT} songs, already in your hymnal`,
    body: `The whole hymn library ships inside the installer and every song is in your hymnal the first time you open it, sorted across ${LIBRARY_CATEGORY_COUNT} categories. Nothing to browse, add or download — search for a hymn and it is there.`,
  },
  {
    icon: WifiOff,
    title: "Runs with the internet unplugged",
    body: `Your hymnal is a file on your computer, not a page that has to load. Nothing stalls mid-service because the church WiFi dropped, and every hymn is on the machine before you have signed in to anything.`,
  },
  {
    icon: MonitorPlay,
    title: "Projector on the second screen",
    body: "Plug in the projector and the lyrics window finds it on its own. Arrow keys move the congregation forward, B blacks the screen, and the operator keeps their notes on the laptop.",
  },
  {
    icon: ListMusic,
    title: "Service orders that stay put",
    body: "Drag songs into the order you'll sing them. Rearrange on Saturday night and the set is waiting on Sunday morning, on the same machine.",
  },
  {
    icon: Save,
    title: "Backups you control",
    body: "One button writes your whole hymnal to a single file. Keep it on a USB stick, restore it on a new computer, and your songs move with you.",
  },
  {
    icon: ShieldCheck,
    title: "Nothing leaves the computer",
    body: "There is no account and no sign-in. Your church's songs are yours, sitting in a file you can copy, and we never see them.",
  },
];

const REQUIREMENTS = [
  { label: "Operating system", value: "Windows 10 or 11, 64-bit" },
  { label: "Disk space", value: "About 400 MB once installed" },
  { label: "Memory", value: "4 GB RAM" },
  { label: "For projection", value: "A second display or a projector" },
  { label: "Internet", value: "Only to download — never to use" },
];

/**
 * The desktop download page.
 *
 * Deliberately shaped like a conventional software download page — one primary
 * action above the fold with the version, size and platform beside it, then
 * what you get, how to install, and what it runs on. The v1 caveat and the
 * unsigned-installer warning are stated plainly rather than buried: a church
 * volunteer who hits a SmartScreen dialog with no warning assumes malware and
 * stops, which is a worse outcome than telling them first.
 */
export function DownloadPage() {
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  return (
    <div className="min-h-svh bg-background">
      <MarketingNav solid />

      {/* ── Hero ─────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden bg-sidebar pb-20 pt-28 text-white sm:pb-24 sm:pt-36">
        {/* A soft wash behind the headline so the dark field is not flat. */}
        <div
          className="pointer-events-none absolute inset-0 opacity-70"
          style={{
            background:
              "radial-gradient(60rem 30rem at 50% -20%, color-mix(in oklch, var(--accent) 22%, transparent), transparent 70%)",
          }}
          aria-hidden="true"
        />

        <div className="relative mx-auto max-w-3xl px-6 text-center">
          <Reveal>
            <div className="flex flex-col items-center gap-3">
              <ReleaseAnnouncement />

              <span className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3.5 py-1.5 text-xs font-medium text-white/90">
                <WindowsIcon className="h-3.5 w-3.5" />
                Desktop app for Windows
              </span>
            </div>

            <h1 className="mt-7 font-display text-4xl leading-[1.08] sm:text-6xl">
              Your hymnal, on the church computer
            </h1>

            <p className="mx-auto mt-5 max-w-xl text-base leading-relaxed text-white/70 sm:text-lg">
              The same SagipMusica, installed. {LIBRARY_SONG_COUNT} songs come
              with it, everything is saved on your machine, and Sunday does not
              depend on the WiFi holding.
            </p>
          </Reveal>

          <Reveal delay={0.12}>
            <div className="mt-10 flex flex-col items-center gap-4">
              {/* The button opens the survey; the dialog is what actually
                  starts the file. Still a plain link underneath, not a fetch:
                  the browser's own download manager handles a 108 MB file far
                  better than we could, and it survives a dropped connection. */}
              <DownloadDialog>
                <Button
                  size="lg"
                  className="h-14 w-full max-w-sm gap-2.5 rounded-xl text-base shadow-lg shadow-black/25 sm:w-auto sm:px-9"
                >
                  <Download className="h-5 w-5" />
                  Download for Windows
                </Button>
              </DownloadDialog>

              <p className="text-sm text-white/55">
                Version {DESKTOP_VERSION} · {DESKTOP_SIZE} · Windows 10 &amp; 11
                (64-bit)
              </p>

              {/* Anyone reading the version number is already asking what is
                  in it, and this is where they find out -- and where they find
                  the older builds if they need one. */}
              <Link
                to="/releases"
                className="inline-flex items-center gap-1.5 text-sm font-medium text-white/75 underline-offset-4 hover:text-white hover:underline"
              >
                <History className="h-4 w-4" />
                What's new, and earlier versions
              </Link>
            </div>
          </Reveal>

          <Reveal delay={0.2}>
            <div className="mt-9 flex flex-col items-center justify-center gap-x-6 gap-y-3 text-sm text-white/60 sm:flex-row">
              <span className="inline-flex items-center gap-2">
                <AppleIcon className="h-4 w-4" />
                macOS version in the works
              </span>
              <span className="hidden h-4 w-px bg-white/20 sm:block" aria-hidden="true" />
              <Link
                to="/signup"
                className="inline-flex items-center gap-1.5 font-medium text-white/85 underline-offset-4 hover:underline"
              >
                Or use it in your browser
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── v1 note ──────────────────────────────────────────────────── */}
      <section className="border-b border-border bg-secondary/40 py-10">
        <div className="mx-auto max-w-3xl px-6">
          <Reveal>
            <div className="flex flex-col gap-4 rounded-xl border border-accent/30 bg-card p-6 sm:flex-row sm:gap-5">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-accent/15 text-accent-foreground">
                <Sparkles className="h-5 w-5" />
              </div>
              <div>
                <h2 className="font-display text-xl font-semibold text-foreground">
                  Still young — expect a few rough edges
                </h2>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  SagipMusica is a young app, so there will be bugs we have not
                  found and things you wish worked differently. Both are worth
                  telling us about. Suggestions from real worship teams are what
                  decide the next version, and they are genuinely welcome — if
                  something gets in your way on a Sunday, we want to hear it.
                </p>
                <Button asChild variant="outline" className="mt-5">
                  <a href={FACEBOOK_URL} target="_blank" rel="noreferrer">
                    <MessageCircle className="h-4 w-4" />
                    Message us on Facebook
                  </a>
                </Button>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── What's coming next ───────────────────────────────────────── */}
      <UpcomingUpdates />

      {/* ── What you get ─────────────────────────────────────────────── */}
      <section className="bg-background py-24 sm:py-28">
        <div className="mx-auto max-w-6xl px-6">
          <Reveal className="max-w-2xl">
            <p className="eyebrow">What comes with it</p>
            <h2 className="mt-4 font-display text-4xl leading-[1.08] text-foreground sm:text-5xl">
              A stocked hymnal, the moment it opens
            </h2>
          </Reveal>

          <div className="staff-rule mt-10 opacity-60" aria-hidden="true" />

          <div className="mt-12 grid grid-cols-1 gap-x-12 gap-y-12 sm:grid-cols-2">
            {FEATURES.map((feature, i) => (
              <Reveal key={feature.title} delay={i * 0.06}>
                <div className="flex gap-5">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-accent/15 text-accent-foreground">
                    <feature.icon className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="font-display text-xl font-semibold text-foreground">
                      {feature.title}
                    </h3>
                    <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                      {feature.body}
                    </p>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── Install + requirements ───────────────────────────────────── */}
      <section className="bg-secondary/40 py-24 sm:py-28">
        <div className="mx-auto grid max-w-6xl grid-cols-1 gap-14 px-6 lg:grid-cols-[1.15fr_1fr] lg:gap-20">
          <div>
            <Reveal>
              <p className="eyebrow">Installing</p>
              <h2 className="mt-4 font-display text-3xl leading-[1.1] text-foreground sm:text-4xl">
                Three steps, about two minutes
              </h2>
            </Reveal>

            <ol className="mt-10 space-y-9">
              {INSTALL_STEPS.map((step, i) => (
                <Reveal key={step.title} delay={i * 0.08}>
                  <li className="relative border-t border-border pt-6">
                    <span
                      className="absolute -top-px left-0 h-px w-12 bg-accent"
                      aria-hidden="true"
                    />
                    <p className="eyebrow text-accent-foreground">
                      Step {i + 1}
                    </p>
                    <h3 className="mt-2 font-display text-xl font-semibold text-foreground">
                      {step.title}
                    </h3>
                    <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                      {step.body}
                    </p>
                  </li>
                </Reveal>
              ))}
            </ol>
          </div>

          <Reveal delay={0.1}>
            <div className="rounded-xl border border-border bg-card p-7 shadow-sm">
              <p className="eyebrow">What it runs on</p>

              <dl className="mt-6 space-y-4">
                {REQUIREMENTS.map((req) => (
                  <div
                    key={req.label}
                    className="flex flex-col gap-1 border-b border-border pb-4 last:border-0 last:pb-0 sm:flex-row sm:items-baseline sm:justify-between sm:gap-6"
                  >
                    <dt className="text-sm text-muted-foreground">{req.label}</dt>
                    <dd className="text-sm font-medium text-foreground sm:text-right">
                      {req.value}
                    </dd>
                  </div>
                ))}
              </dl>

              <div className="staff-rule my-7 opacity-50" aria-hidden="true" />

              <DownloadDialog>
                <Button className="w-full gap-2">
                  <Download className="h-4 w-4" />
                  Download {DESKTOP_SIZE}
                </Button>
              </DownloadDialog>

              <p className="mt-4 text-center text-xs leading-relaxed text-muted-foreground">
                Released {DESKTOP_RELEASED}.
              </p>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── Support ──────────────────────────────────────────────────── */}
      <section className="bg-background py-24 sm:py-28">
        <div className="mx-auto max-w-3xl px-6">
          <Reveal>
            <div className="flex h-full flex-col rounded-xl border border-border bg-primary p-8 text-primary-foreground shadow-sm sm:p-10">
              <Heart className="h-5 w-5" />
              <h2 className="mt-4 font-display text-2xl font-medium sm:text-3xl">
                Help keep it free for every church
              </h2>
              <p className="mt-3 text-sm leading-relaxed text-primary-foreground/80 sm:text-base">
                SagipMusica costs nothing to download and nothing to use, and we
                would like to keep it that way — especially for the small
                congregations who need it most. If it has saved your team time,
                a small gift covers the hosting, the signing certificate that
                clears that Windows warning, and the next set of improvements.
              </p>
              <SupportDialog />
            </div>
          </Reveal>
        </div>
      </section>

      <MarketingFooter />
    </div>
  );
}
