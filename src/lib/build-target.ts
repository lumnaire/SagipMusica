/**
 * The handful of product differences between the hosted app and the desktop
 * build, for the pages both of them share.
 *
 * The desktop renderer imports those pages from `../src` verbatim and swaps
 * the modules underneath them (see desktop/electron.vite.config.ts). This file
 * is aliased the same way, so a shared page can ask what it is running inside
 * without importing anything Electron-shaped.
 *
 * Keep this to genuine product differences. Anything that is merely a
 * different way of fetching the same thing belongs in a data-layer stand-in,
 * not behind a flag here.
 */

/**
 * Whether songs are browsed and copied out of a shared catalog.
 *
 * True on the web: the library is platform-owned, an encoder maintains it, and
 * a church takes what it wants from it. False on the desktop, where the whole
 * library ships inside the installer and is already in the hymnal on first
 * launch — there is nothing left to browse.
 */
export const HAS_SHARED_LIBRARY: boolean = true;
