// Generates desktop/resources/hymnal-seed.json — the hymn library that ships
// inside the installer — from the committed Supabase migrations.
//
//   node scripts/build-seed.mjs
//
// Source of truth is supabase/migrations/0008_starter_hymns.sql (the 20 starter
// hymns) and 0013_fbc_hymnal.sql (399 FBC hymns). The upstream hymns.json that
// scripts/generate-hymnal-migration.mjs reads lives in a separate project and
// is not vendored here, so the committed SQL is what we parse.
//
// The output is committed so a clean checkout can build the app without the
// upstream hymnal project present.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, "..", "..");
const STARTERS_SQL = resolve(ROOT, "supabase/migrations/0008_starter_hymns.sql");
const HYMNAL_SQL = resolve(ROOT, "supabase/migrations/0013_fbc_hymnal.sql");
const OUT = resolve(HERE, "..", "resources", "hymnal-seed.json");

// 0012 flips these two to metadata_only: still under copyright, no lyrics.
const METADATA_ONLY_STARTERS = new Set(["How Great Thou Art", "Victory in Jesus"]);

/**
 * Stable id for a starter hymn. 0008 lets Postgres generate the uuid, so there
 * is nothing in the file to carry over — but the id must not change between
 * builds, or `songs.source_template_id` on an existing install would stop
 * matching the library. Derived from the title, shaped as a v5 uuid.
 */
function starterId(title) {
  const h = createHash("sha1").update(`sagipmusica-starter:${title}`).digest("hex");
  const variant = ((parseInt(h.slice(16, 18), 16) & 0x3f) | 0x80).toString(16);
  return [
    h.slice(0, 8),
    h.slice(8, 12),
    `5${h.slice(13, 16)}`,
    `${variant}${h.slice(18, 20)}`,
    h.slice(20, 32),
  ].join("-");
}

/**
 * Splits a Postgres `values` row list into arrays of JS values.
 *
 * Handles the literal forms these two files actually use: plain quoted strings
 * with doubled-quote escapes, E-prefixed escape strings which additionally
 * honour backslash escapes, and bare null / boolean / integer. A bare
 * identifier (0008 uses the plpgsql variable `t` for template_id) comes back
 * as an { ident } object so the caller can reject it.
 */
function parseRows(sql) {
  const rows = [];
  let i = 0;

  const skipSpace = () => {
    while (i < sql.length && /[\s,]/.test(sql[i])) i++;
  };

  const readString = (isEscapeString) => {
    i++; // opening quote
    let out = "";
    while (i < sql.length) {
      const c = sql[i];
      if (c === "'") {
        if (sql[i + 1] === "'") {
          out += "'";
          i += 2;
          continue;
        }
        i++;
        return out;
      }
      if (isEscapeString && c === "\\") {
        const n = sql[i + 1];
        if (n === "n") out += "\n";
        else if (n === "t") out += "\t";
        else if (n === "r") out += "\r";
        else out += n;
        i += 2;
        continue;
      }
      out += c;
      i++;
    }
    throw new Error("Unterminated string literal");
  };

  const readValue = () => {
    skipSpace();
    const c = sql[i];
    if (c === "'") return readString(false);
    if ((c === "E" || c === "e") && sql[i + 1] === "'") {
      i++;
      return readString(true);
    }
    const start = i;
    while (i < sql.length && !/[,)]/.test(sql[i])) i++;
    const raw = sql.slice(start, i).trim();
    if (/^null$/i.test(raw)) return null;
    if (/^true$/i.test(raw)) return true;
    if (/^false$/i.test(raw)) return false;
    if (/^-?\d+$/.test(raw)) return Number(raw);
    return { ident: raw };
  };

  while (i < sql.length) {
    skipSpace();
    if (sql[i] !== "(") break;
    i++;
    const row = [];
    for (;;) {
      row.push(readValue());
      skipSpace();
      if (sql[i] === ")") {
        i++;
        break;
      }
      if (i >= sql.length) throw new Error("Unterminated row");
    }
    rows.push(row);
    skipSpace();
    if (sql[i] === ";") break;
  }
  return rows;
}

/** Finds each `insert into <table> (cols) values ...;` statement, in file order. */
function findInserts(sql, table) {
  const out = [];
  const re = new RegExp(`insert\\s+into\\s+${table}\\s*\\(([^)]*)\\)\\s*values`, "gi");
  let m;
  while ((m = re.exec(sql)) !== null) {
    const columns = m[1].split(",").map((c) => c.trim());
    const bodyStart = m.index + m[0].length;
    // The statement ends at the first semicolon that is not inside a literal.
    let j = bodyStart;
    let inString = false;
    while (j < sql.length) {
      const c = sql[j];
      if (c === "'") {
        if (inString && sql[j + 1] === "'") j++;
        else inString = !inString;
      } else if (c === "\\" && inString) {
        j++;
      } else if (c === ";" && !inString) {
        break;
      }
      j++;
    }
    out.push({ columns, body: sql.slice(bodyStart, j), start: m.index });
    re.lastIndex = j;
  }
  return out;
}

const toObject = (columns, row) =>
  Object.fromEntries(columns.map((c, idx) => [c, row[idx] ?? null]));

const templates = [];
const sections = [];

// ------------------------------------------------------------------ 0008
// 18 hymns inside a plpgsql DO block, each template insert immediately
// followed by its own sections insert, then a final two-row insert outside the
// block for the copyrighted titles that ship without lyrics. 18 + 2 = 20.
{
  const sql = readFileSync(STARTERS_SQL, "utf8");
  const templateInserts = findInserts(sql, "hymn_templates");
  const sectionInserts = findInserts(sql, "hymn_template_sections");

  for (const ins of templateInserts) {
    const rows = parseRows(ins.body);
    for (const row of rows) {
      const t = toObject(ins.columns, row);
      templates.push({
        id: starterId(t.title),
        title: t.title,
        author: t.author ?? null,
        composer: t.composer ?? null,
        category: t.category ?? null,
        key: t.key ?? null,
        tempo: t.tempo ?? null,
        description: t.description ?? null,
        // 0012: `update hymn_templates set status='published', is_starter=true`
        status: "published",
        is_starter: 1,
        copyright_status: METADATA_ONLY_STARTERS.has(t.title)
          ? "metadata_only"
          : "public_domain",
        order_index: t.order_index ?? 0,
      });
    }

    // A single-row template insert inside the DO block owns the next sections
    // insert in the file. The two metadata-only hymns arrive as one two-row
    // insert and have no sections, so they are skipped here.
    if (rows.length !== 1) continue;
    const next = sectionInserts.find((s) => s.start > ins.start);
    if (!next) continue;
    const id = starterId(toObject(ins.columns, rows[0]).title);
    for (const srow of parseRows(next.body)) {
      const s = toObject(next.columns, srow);
      sections.push({
        template_id: id,
        type: s.type,
        title: s.title,
        lyrics: s.lyrics,
        order_index: s.order_index,
      });
    }
    // Consume it, so a later template cannot pair with the same block.
    sectionInserts.splice(sectionInserts.indexOf(next), 1);
  }
}

// ------------------------------------------------------------------ 0013
// One 399-row template insert with explicit ids, and one sections insert that
// references those ids directly.
{
  const sql = readFileSync(HYMNAL_SQL, "utf8");
  for (const ins of findInserts(sql, "hymn_templates")) {
    for (const row of parseRows(ins.body)) {
      const t = toObject(ins.columns, row);
      templates.push({
        id: t.id,
        title: t.title,
        author: t.author ?? null,
        composer: t.composer ?? null,
        category: t.category ?? null,
        key: t.key ?? null,
        tempo: t.tempo ?? null,
        description: t.description ?? null,
        // 0013: "These are published but NOT starter hymns".
        status: "published",
        is_starter: 0,
        copyright_status: t.copyright_status ?? "public_domain",
        order_index: t.order_index ?? 0,
      });
    }
  }
  for (const ins of findInserts(sql, "hymn_template_sections")) {
    for (const row of parseRows(ins.body)) {
      const s = toObject(ins.columns, row);
      sections.push({
        template_id: s.template_id,
        type: s.type,
        title: s.title,
        lyrics: s.lyrics,
        order_index: s.order_index,
      });
    }
  }
}

// ------------------------------------------------------------------ checks
// The parser is doing real work on generated SQL, so assert the shape rather
// than trusting it. A bad seed would ship inside the installer.
const ids = new Set(templates.map((t) => t.id));
if (ids.size !== templates.length) throw new Error("Duplicate template ids in seed");
for (const t of templates) {
  if (typeof t.id !== "string" || typeof t.title !== "string") {
    throw new Error(`Malformed template: ${JSON.stringify(t)}`);
  }
}
for (const s of sections) {
  if (typeof s.template_id !== "string") {
    throw new Error(`Section has a non-literal template_id: ${JSON.stringify(s.template_id)}`);
  }
  if (!ids.has(s.template_id)) {
    throw new Error(`Section points at an unknown template: ${s.template_id}`);
  }
  if (typeof s.lyrics !== "string" || typeof s.title !== "string") {
    throw new Error(`Section ${s.template_id} has a malformed title or lyrics`);
  }
  if (typeof s.order_index !== "number") {
    throw new Error(`Section ${s.template_id} has a malformed order_index`);
  }
}
const starters = templates.filter((t) => t.is_starter === 1);
if (starters.length !== 20) {
  throw new Error(`Expected 20 starter hymns, parsed ${starters.length}`);
}

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(
  OUT,
  `${JSON.stringify(
    {
      generatedBy: "desktop/scripts/build-seed.mjs",
      sources: [
        "supabase/migrations/0008_starter_hymns.sql",
        "supabase/migrations/0013_fbc_hymnal.sql",
      ],
      templates,
      sections,
    },
    null,
    2,
  )}\n`,
  "utf8",
);

const withLyrics = new Set(sections.map((s) => s.template_id)).size;
console.log(`templates : ${templates.length} (${starters.length} starter)`);
console.log(`sections  : ${sections.length} across ${withLyrics} templates`);
console.log(
  `metadata  : ${templates.filter((t) => t.copyright_status === "metadata_only").length} without lyrics`,
);
console.log(`written   : ${OUT}`);
