/**
 * Everything the download page states about the installer, in one place.
 *
 * These numbers are printed on the page, so they have to match the artifact
 * that `npm run build:win` produces in desktop/release/. When a new version
 * ships, update this file and nothing else.
 */

/** Matches `version` in desktop/package.json. */
export const DESKTOP_VERSION = "1.0.0";

/** The .exe size, rounded the way a download page conventionally shows it. */
export const DESKTOP_SIZE = "108 MB";

export const DESKTOP_RELEASED = "24 August 2026";

/**
 * GitHub's `releases/latest/download/<asset>` redirect, not a link to one
 * tagged release: it resolves to whichever release is newest, so publishing
 * v1.0.1 updates this page's button without a code change. The filename is
 * fixed by `artifactName` in desktop/electron-builder.yml.
 */
export const DOWNLOAD_URL =
  "https://github.com/lumnaire/fbc-worship-tool/releases/latest/download/SagipMusica-Setup.exe";

/** Where the full list of builds and their notes lives. */
export const RELEASES_URL = "https://github.com/lumnaire/fbc-worship-tool/releases";

export const FACEBOOK_URL = "https://www.facebook.com/lumnaireph";

/**
 * What the page says about the bundled hymn library.
 *
 * `LIBRARY_SONG_COUNT` is display copy, not an exact figure — the seed in
 * desktop/resources/hymnal-seed.json currently holds 419 templates, and "400+"
 * stays true as songs are added without needing an edit here every time.
 */
export const LIBRARY_SONG_COUNT = "400+";
export const LIBRARY_CATEGORY_COUNT = 33;
export const STARTER_SONG_COUNT = 20;

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
    title: "Open it and start browsing",
    body: `SagipMusica sets itself up on first launch and lands on a dashboard with ${STARTER_SONG_COUNT} hymns already in place. The rest of the library is under Songs → Library.`,
  },
];
