// Generates supabase/migrations/0013_fbc_hymnal.sql and
// docs/hymnal-copyright-review.md from the FBC hymnal JSON.
//
//   node scripts/generate-hymnal-migration.mjs [path/to/hymns.json]
//
// The source file lives in a separate project (fbc-hymnal-collections) and is
// not vendored here, so pass its path if it is not at the default below.
// Edit COPYRIGHTED / NEEDS_REVIEW here and re-run rather than hand-editing the
// generated SQL.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const SRC =
  process.argv[2] ??
  resolve(ROOT, "../../Frontend/PROJECTS/fbc-hymnal-collections/data/hymns.json");
const OUT = resolve(ROOT, "supabase/migrations/0013_fbc_hymnal.sql");
const REVIEW = resolve(ROOT, "docs/hymnal-copyright-review.md");

/**
 * Hymns whose words are still under copyright. These are imported as metadata
 * only -- title, category, no lyrics -- exactly as 0008 already treats How
 * Great Thou Art and Victory in Jesus. Each church adds the words under its
 * own CCLI licence.
 *
 * Keyed by the source file's hymn number, which is how you find them again in
 * hymns.json. That number is NOT carried into the database.
 *
 * US rule of thumb applied: published 1930 or later => still protected.
 */
const COPYRIGHTED = new Map([
  ["12", "Stuart K. Hine's English text, 1949"],
  ["56", "Ruth Caye Jones, 1944"],
  ["82", "Gloria & William J. Gaither, 1971"],
  ["90", "E. M. Bartlett, 1939"],
  ["93", "John M. Moore, 1952"],
  ["100", "G. E. Wright, 1950s"],
  ["104", "William J. Gaither, 1963"],
  ["110", "John W. Peterson, 1961"],
  ["120", "Homer Rodeheaver / Oswald J. Smith, 1940"],
  ["146", "John W. Peterson & Alfred B. Smith, 1958"],
  ["147", "Charles F. Weigle, 1932"],
  ["186", "George Beverly Shea's tune, 1939"],
  ["220", "Margaret Clarkson, 1954"],
  ["252", "Ira F. Stanphill, 1952"],
  ["306", "Ira F. Stanphill, 1949"],
  ["333", "Esther Kerr Rusthoi, 1941"],
  ["357", "Norman J. Clayton, 1943"],
  ["364", "John W. Peterson, 1948"],
  ["370", "Common arrangement, 1959"],
  ["372", "Matt Merker's refrain and tune, 2013"],
  ["380", "J. Edwin Orr, 1936"],
]);

/**
 * Titles I could not date with confidence -- mostly 20th-century gospel and
 * chorus-book material. Imported WITH lyrics, but listed in the review doc so
 * an encoder can check them and flip any to "no lyrics" from /encoder.
 */
const NEEDS_REVIEW = new Set([
  "4", "8", "11", "16", "20", "22", "24", "73", "79", "85", "87", "117", "119",
  "129", "130", "140", "144", "157", "159", "180", "195", "196", "197", "198",
  "201", "204", "216", "224", "225", "235", "237", "240", "242", "249", "250",
  "251", "257", "259", "262", "264", "269", "270", "275", "276", "279", "285",
  "286", "290", "300", "367", "398",
]);

/** Their taxonomy is richer; only fold the ones that genuinely already exist. */
const CATEGORY_MAP = {
  "Praise and Worship": "Praise & Worship",
  Hymns: "Hymn",
  "Gospel Songs": "Gospel",
};

/**
 * Stable UUIDv5-style id derived from the hymn's position in the source file.
 *
 * The templates need explicit ids so their sections can reference them without
 * a lookup. Matching on title would not work -- this hymnal genuinely repeats
 * titles ("Jesus Loves Me" is both 299 and 363), so a title join would staple
 * one hymn's lyrics onto another. Deriving the id keeps the generator
 * reproducible: re-running produces byte-identical SQL.
 */
function uuidFor(key) {
  const b = Buffer.from(
    createHash("sha1").update(`sagipmusica:fbc-hymnal:${key}`).digest().subarray(0, 16),
  );
  b[6] = (b[6] & 0x0f) | 0x50; // version 5
  b[8] = (b[8] & 0x3f) | 0x80; // RFC 4122 variant
  const s = b.toString("hex");
  return `${s.slice(0, 8)}-${s.slice(8, 12)}-${s.slice(12, 16)}-${s.slice(16, 20)}-${s.slice(20, 32)}`;
}

/** Postgres E'' literal: escape backslash, then quote, then real newlines. */
function sql(str) {
  if (str === null || str === undefined || str === "") return "null";
  const escaped = String(str)
    .replace(/\\/g, "\\\\")
    .replace(/'/g, "''")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/\n/g, "\\n");
  return `E'${escaped}'`;
}

const raw = JSON.parse(readFileSync(SRC, "utf8"));

const ids = [];
const templateRows = [];
const sectionRows = [];
const stats = { total: 0, metadataOnly: 0, sections: 0, dropped: 0 };

raw.hymns.forEach((h, index) => {
  stats.total++;
  const num = String(h.number);
  const id = uuidFor(num);
  ids.push(id);

  const isCopyrighted = COPYRIGHTED.has(num);
  const category = CATEGORY_MAP[h.category] ?? h.category;
  const description = isCopyrighted
    ? `Lyrics not included: ${COPYRIGHTED.get(num)}. Add the words under your church's CCLI licence.`
    : null;

  templateRows.push(
    `  ('${id}', ${sql(h.title)}, ${sql(h.author ?? null)}, ${sql(category)}, ` +
      `${sql(description)}, ${isCopyrighted ? "'metadata_only'" : "'public_domain'"}, ${index + 1})`,
  );

  if (isCopyrighted) {
    stats.metadataOnly++;
    return;
  }

  // Collapse the chorus repeated after every verse down to its first
  // appearance, which is how the 0008 starter hymns are already stored: the
  // presenter jumps back to it rather than walking N identical slides.
  const seenChorus = new Set();
  const kept = [];
  let verseNo = 0;
  for (const line of h.lyrics ?? []) {
    const content = (line.content ?? "").trim();
    if (!content) continue;
    if (line.type === "chorus") {
      const key = content.replace(/\s+/g, " ").toLowerCase();
      if (seenChorus.has(key)) {
        stats.dropped++;
        continue;
      }
      seenChorus.add(key);
      kept.push({
        type: "chorus",
        title: seenChorus.size > 1 ? `Chorus ${seenChorus.size}` : "Chorus",
        content,
      });
    } else {
      verseNo++;
      kept.push({ type: "verse", title: `Verse ${line.verse ?? verseNo}`, content });
    }
  }

  stats.sections += kept.length;
  for (const [i, s] of kept.entries()) {
    sectionRows.push(`  ('${id}', '${s.type}', ${sql(s.title)}, ${sql(s.content)}, ${i})`);
  }
});

const header = `-- First Baptist Church hymnal: ${stats.total} hymns imported into the shared library.
--
-- Source: fbc-hymnal-collections/data/hymns.json (version ${raw.version}).
-- GENERATED by scripts/generate-hymnal-migration.mjs -- do not hand-edit.
-- Change the script and re-run it instead; the output is reproducible.
--
-- Three transformations were applied on the way in:
--
--  1. COPYRIGHT. ${stats.metadataOnly} hymns whose words are still protected are imported as
--     metadata only, with no lyrics, and marked copyright_status='metadata_only'.
--     This matches what 0008 already did for How Great Thou Art and Victory in
--     Jesus. Churches add the words under their own CCLI licence. See
--     docs/hymnal-copyright-review.md for the list and the titles that still
--     need a human check.
--
--  2. REPEATED CHORUSES. The source repeats the identical chorus after every
--     verse. ${stats.dropped} such repeats were dropped, keeping the first appearance, so a
--     song reads verse/chorus/verse/verse -- the same shape as the 0008
--     starter hymns.
--
--  3. CATEGORIES. Their taxonomy is kept as-is except where it duplicated one
--     of ours: "Praise and Worship" -> "Praise & Worship", "Hymns" -> "Hymn",
--     "Gospel Songs" -> "Gospel".
--
-- The source hymnal's numbering is deliberately NOT imported -- only the order
-- it implies, via order_index.
--
-- Template ids are explicit and derived from the source, so sections can point
-- at their parent without a lookup. Matching on title would not do: this
-- hymnal repeats titles ("Jesus Loves Me" appears twice), and a title join
-- would attach one hymn's lyrics to another.
--
-- These are published but NOT starter hymns: new churches still receive only
-- the original 20. Admins pull these in from /songs/library.

-- Idempotent: re-running replaces this import cleanly, by id, so an encoder's
-- own songs are never touched. Copies churches already took survive too --
-- songs.source_template_id is ON DELETE SET NULL.
delete from hymn_templates where id in (
${ids.map((id) => `  '${id}'`).join(",\n")}
);

insert into hymn_templates
  (id, title, author, category, description, copyright_status, order_index)
values
${templateRows.join(",\n")};

update hymn_templates set status = 'published', is_starter = false
where id in (
${ids.map((id) => `  '${id}'`).join(",\n")}
);

insert into hymn_template_sections (template_id, type, title, lyrics, order_index)
values
${sectionRows.join(",\n")};
`;

mkdirSync(dirname(OUT), { recursive: true });
mkdirSync(dirname(REVIEW), { recursive: true });
writeFileSync(OUT, header, "utf8");

// ---- review doc ----
const byNum = (n) => raw.hymns.find((x) => String(x.number) === n);

const flagged = [...COPYRIGHTED.entries()]
  .map(([n, why]) => `| ${n} | ${byNum(n)?.title ?? "?"} | ${why} |`)
  .join("\n");

const review = [...NEEDS_REVIEW]
  .map((n) => (byNum(n) ? `| ${n} | ${byNum(n).title} | ${byNum(n).category} |` : null))
  .filter(Boolean)
  .join("\n");

writeFileSync(
  REVIEW,
  `# Hymnal import — copyright review

The FBC hymnal (\`0013_fbc_hymnal.sql\`) imports ${stats.total} hymns into the shared
song library. Because an encoder publishes to **every church on the platform**,
the platform is the one distributing the words — a different position from a
single church reproducing them under its own CCLI licence.

This is a best-effort classification, not legal advice. Please review it.

> The **#** column below is the hymn's number in \`hymns.json\`, so you can find it
> in the source file. It is not stored anywhere in the app or database.

## Imported without lyrics (${stats.metadataOnly})

Marked \`copyright_status = 'metadata_only'\`. Title and category are present so
churches can find the hymn and add the words themselves.

| # | Title | Why |
|---|-------|-----|
${flagged}

## Imported WITH lyrics, but worth checking (${NEEDS_REVIEW.size})

These are mostly 20th-century gospel and chorus-book material that I could not
date confidently. They came in with full lyrics. If any turn out to be under
copyright, open the song in \`/encoder\`, set **Copyright** to *No lyrics — still
under copyright*, and clear its sections.

| # | Title | Category |
|---|-------|----------|
${review}

## Everything else

The remaining ${stats.total - stats.metadataOnly - NEEDS_REVIEW.size} hymns are 19th- or early-20th-century works published
before 1930, and are public domain in the US.
`,
  "utf8",
);

console.log(JSON.stringify(stats, null, 2));
console.log("wrote", OUT);
console.log("wrote", REVIEW);
