// Splices the generated country data into the migrations that seed it.
//
//   npm run map:generate
//
// A migration has to be a single self-contained file -- Supabase applies it as
// one -- but 234 coordinates and 56 alias lists are not something to
// transcribe by hand, so they are generated and pasted. This is the paste.
//
//   scripts/out/country-places.sql  -> 0018_map_pins.sql        (slug/name/lat/lng)
//   scripts/out/country-aliases.sql -> 0019_map_matcher_index.sql (ISO names)
//
// Only useful while a migration is still unreleased. Once one has been applied
// to a live database it is history and must not be edited; a change to the
// gazetteer after that point belongs in a new migration.
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

/**
 * Replaces whatever sits between two anchor strings with the rows from a
 * generated file.
 *
 * The anchors are the lines that already wrap the block rather than a
 * placeholder comment, so this stays re-runnable after the first paste.
 */
function splice({ migration, rows, open, close }) {
  const file = resolve(ROOT, "supabase/migrations", migration);
  const text = readFileSync(file, "utf8");

  const start = text.indexOf(open);
  if (start === -1) throw new Error(`opening anchor not found in ${migration}`);
  const end = text.indexOf(close, start + open.length);
  if (end === -1) throw new Error(`closing anchor not found in ${migration}`);

  const body = readFileSync(resolve(ROOT, "scripts/out", rows), "utf8")
    .split("\n")
    .filter((line) => line.trim().startsWith("("))
    .join("\n")
    // The generated file is a standalone list and ends each line with a comma;
    // the last row inside a `values` block must not have one.
    .replace(/,$/, "");

  writeFileSync(file, text.slice(0, start + open.length) + body + text.slice(end));
  console.log(`inlined ${body.split("\n").length} rows into ${migration}`);
}

splice({
  migration: "0018_map_pins.sql",
  rows: "country-places.sql",
  open:
    "insert into map_places (slug, name, kind, country_code, lat, lng, source)\n" +
    "select v.slug, v.name, 'country', v.code, v.lat, v.lng, 'seed'\n" +
    "from (values\n",
  close: "\n) as v(slug, name, code, lat, lng)",
});

splice({
  migration: "0019_map_matcher_index.sql",
  rows: "country-aliases.sql",
  open: "from (values\n",
  close: "\n) as v(code, extra)",
});
