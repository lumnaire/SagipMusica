/**
 * Every published build of the desktop app, newest first.
 *
 * This is the single source of truth for the version the download page
 * advertises, the announcement pill on the marketing site, and the table on
 * /releases. Shipping a new build means adding one entry to the top of this
 * array — nothing else on the site needs editing, because everything that
 * quotes a version number derives it from `LATEST_RELEASE` below.
 *
 * ── Adding a release ─────────────────────────────────────────────────────
 *
 *  1. Publish the GitHub release first, with the tag written in `tag` here.
 *     The links on /releases are built from that tag, so a row added before
 *     the release exists is a 404 with a Download button on it.
 *  2. `version` must match `version` in desktop/package.json — it is what
 *     Settings shows inside the app, and the two disagreeing is the kind of
 *     thing a bug report is filed about.
 *  3. `size` is the .exe as a human reads it, rounded to the megabyte.
 *
 * The asset filename is fixed and versionless (`artifactName` in
 * desktop/electron-builder.yml), which is what lets every tag serve a file at
 * the same path and lets `releases/latest/download/...` resolve without a code
 * change here.
 */

export interface Release {
  /** Matches desktop/package.json. */
  version: string;
  /** The GitHub tag. The download link for older builds is built from it. */
  tag: string;
  /** ISO date, so rows sort and `<time>` gets a machine-readable value. */
  date: string;
  /** Display size of the Windows installer. */
  size: string;
  /**
   * What changed, in the words a worship team would use. Kept short — this is
   * a table cell, not a changelog. Two to four lines reads best.
   */
  highlights: string[];
  /** One line under the version on the latest-release card. */
  summary: string;
}

/**
 * NEWEST FIRST. The order is load-bearing: the first entry is treated as the
 * current release everywhere, rather than a flag on the row that could be set
 * on two of them at once.
 */
export const RELEASES: Release[] = [
  {
    version: "1.2.1",
    tag: "v1.2.1",
    date: "2026-08-27",
    size: "109 MB",
    summary: "The whole Bible, built in — and a guided setup the first time you open it.",
    highlights: [
      "The complete King James Version ships inside the installer — no add-on, and it works with the internet unplugged",
      "Put scripture on the projector a verse at a time; type a reference like John 3:16 or search for the words you remember",
      "A short walkthrough on first launch, so a new install does not open on somebody else's church name",
      "Fixed: the slide preview kept its fullscreen size after leaving fullscreen, pushing lyrics off the edge",
    ],
  },
  {
    version: "1.0.1",
    tag: "v1.0.1",
    date: "2026-08-24",
    size: "108 MB",
    summary: "Every hymn in the library moved into your hymnal on first launch.",
    highlights: [
      "All 400+ hymns are in your hymnal the moment you open the app — nothing to browse or add",
      "The separate library page is gone, because there was no longer anything in it you did not already have",
      "Upgrading from 1.0.0 brings the rest of the library across automatically",
    ],
  },
];

/**
 * The build the site recommends. Derived rather than flagged, so it cannot
 * disagree with the order of the list.
 */
export const LATEST_RELEASE = RELEASES[0];

/** Everything the newest build replaced. Still downloadable — see /releases. */
export const PREVIOUS_RELEASES = RELEASES.slice(1);

const REPO = "https://github.com/lumnaire/fbc-worship-tool";

/**
 * Where a given build's installer lives.
 *
 * The newest one goes through `releases/latest/download/…`, GitHub's redirect
 * to whichever release is newest, rather than its own tag: it keeps working if
 * a release is re-tagged or re-cut, and it is the same URL the download page
 * has always used. Older builds have to name their tag, because "latest" is
 * precisely what they are not.
 */
export function installerUrl(release: Release): string {
  return release === LATEST_RELEASE
    ? `${REPO}/releases/latest/download/SagipMusica-Setup.exe`
    : `${REPO}/releases/download/${release.tag}/SagipMusica-Setup.exe`;
}

/** The release's page on GitHub, for anyone who wants the raw notes. */
export function releaseNotesUrl(release: Release): string {
  return `${REPO}/releases/tag/${release.tag}`;
}

/** "27 August 2026" — the form the download page has always used. */
export function formatReleaseDate(isoDate: string): string {
  return new Date(`${isoDate}T00:00:00Z`).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}
