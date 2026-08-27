/**
 * Everything the download page states about the installer, in one place.
 *
 * The version, date and size are NOT written here any more -- they are read
 * off the newest entry in releases.ts. This file said 1.0.1 for the whole of
 * 1.1 and 1.2 because it was a second place to remember, and a download page
 * advertising a version that is two releases old is worse than one with no
 * version on it at all. Ship a build by adding a row to RELEASES; this
 * follows.
 */
import { LATEST_RELEASE, formatReleaseDate, installerUrl } from "./releases";

/** Matches `version` in desktop/package.json, via releases.ts. */
export const DESKTOP_VERSION = LATEST_RELEASE.version;

/** The .exe size, rounded the way a download page conventionally shows it. */
export const DESKTOP_SIZE = LATEST_RELEASE.size;

export const DESKTOP_RELEASED = formatReleaseDate(LATEST_RELEASE.date);

/**
 * GitHub's `releases/latest/download/<asset>` redirect, not a link to one
 * tagged release: it resolves to whichever release is newest, so publishing a
 * new version updates this page's button without a code change. The filename
 * is fixed by `artifactName` in desktop/electron-builder.yml.
 */
export const DOWNLOAD_URL = installerUrl(LATEST_RELEASE);

/** Where the full list of builds and their notes lives. */
export const RELEASES_URL = "/releases";

export const FACEBOOK_URL = "https://www.facebook.com/lumnaireph";

/**
 * What the page says about the bundled hymn library.
 *
 * `LIBRARY_SONG_COUNT` is display copy, not an exact figure — the seed in
 * desktop/resources/hymnal-seed.json currently holds 419 templates, and "400+"
 * stays true as songs are added without needing an edit here every time.
 *
 * As of 1.0.1 there is no separate library to browse on the desktop: the first
 * launch copies every one of those hymns straight into the church's hymnal
 * (see desktop/src/main/db/seed.ts), which is why the copy below talks about
 * what is *in the hymnal* rather than what is available to add.
 */
export const LIBRARY_SONG_COUNT = "400+";
export const LIBRARY_CATEGORY_COUNT = 33;

/**
 * What a first-time installer has to do, in order.
 *
 * Lives here rather than in the page because the download dialog walks people
 * through the same three steps the moment the file starts, and the two must
 * never drift apart -- the SmartScreen warning in step two is the whole reason
 * the dialog exists.
 */
export const INSTALL_STEPS = [
  {
    title: "Download and run the installer",
    body: "The file is SagipMusica-Setup.exe. It installs for your user only, so Windows will not ask for an administrator password.",
  },
  {
    title: "Click through the blue warning",
    body: "Windows will say \"Windows protected your PC\" because this build is not code-signed yet — a certificate is on the list. Choose More info, then Run anyway.",
  },
  {
    title: "Open it and start singing",
    body: `SagipMusica sets itself up on first launch, and every one of the ${LIBRARY_SONG_COUNT} hymns is already in your hymnal under Songs. Nothing to add, nothing to download.`,
  },
];
