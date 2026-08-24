/**
 * Desktop stand-in for src/lib/build-target.ts.
 *
 * See that file for what each flag means. This one exists so the shared pages
 * can drop the parts of themselves that only make sense with a server behind
 * them.
 */

/**
 * No catalog to browse here. The installer carries the whole library and the
 * first launch copies all of it into the hymnal (see main/db/seed.ts), so the
 * "Browse library" route and its entry points are absent from this build.
 */
export const HAS_SHARED_LIBRARY: boolean = false;
