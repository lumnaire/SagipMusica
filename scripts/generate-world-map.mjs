// Generates the two halves of the pin map that neither the app nor the
// database should be hand-maintaining:
//
//   src/features/map/world-geometry.ts   the SVG outline of the world
//   scripts/out/country-places.sql       one gazetteer row per country
//
//   node scripts/generate-world-map.mjs
//
// Both come from Natural Earth via the `world-atlas` package, which is a
// devDependency: nothing here runs at request time, and the app ships the
// generated file rather than the topology.
//
// Why a generated SVG rather than a tile layer: vercel.json sets
// `img-src 'self' data: blob:`, so a map that fetched tiles from CARTO or
// OpenStreetMap would need that header widened for every page on the site.
// Trading a hardened CSP for a basemap is a bad deal when the pins are only
// ever accurate to a province, and a 1000-unit-wide outline is plenty for that.
//
// Re-run this if the world changes shape or the projection below is retuned.
// Do not hand-edit either output.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { feature } from "topojson-client";
import isoCountries from "i18n-iso-countries";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

// 50m rather than 110m. At 110m the Philippines -- the single most important
// place on this map -- collapses into three unrecognisable blobs, and the
// whole point is that a Filipino church can find its own island. The section
// that renders the result is lazy-loaded, so the extra weight is not on the
// critical path.
const TOPO = resolve(ROOT, "node_modules/world-atlas/countries-50m.json");
const GEOMETRY_OUT = resolve(ROOT, "src/features/map/world-geometry.ts");
const PLACES_OUT = resolve(ROOT, "scripts/out/country-places.sql");
const ALIASES_OUT = resolve(ROOT, "scripts/out/country-aliases.sql");

// ---------------------------------------------------------------------------
// Projection
//
// Web Mercator into a 1000x1000 square, which keeps the numbers small and lets
// the runtime projection in src/features/map/projection.ts be four lines that
// obviously match this one. If you change either, change both -- a pin drawn
// with a different projection than the coastline lands in the sea.
// ---------------------------------------------------------------------------

const SIZE = 1000;
/** Mercator runs to infinity at the poles; every atlas picks a cutoff. */
const LAT_CLAMP = 84;

function projectX(lng) {
  return ((lng + 180) / 360) * SIZE;
}

function projectY(lat) {
  const phi = (Math.max(-LAT_CLAMP, Math.min(LAT_CLAMP, lat)) * Math.PI) / 180;
  const merc = Math.log(Math.tan(Math.PI / 4 + phi / 2));
  return (SIZE / 2) * (1 - merc / Math.PI);
}

// The frame. Antarctica is dropped entirely (see below) and there is nothing
// above Svalbard worth the vertical space, so the map is cropped to the band
// people actually live in rather than being letterboxed by empty ice.
const VIEW_TOP = projectY(83);
const VIEW_BOTTOM = projectY(-57);

/** Antarctica: no congregations, and it doubles the height of the drawing. */
const SKIP_IDS = new Set(["010"]);

// ---------------------------------------------------------------------------
// Path building
// ---------------------------------------------------------------------------

/** One decimal is a tenth of a viewBox unit -- far below a rendered pixel. */
function round(n) {
  return Math.round(n * 10) / 10;
}

/**
 * Ramer-Douglas-Peucker on the *projected* ring, so the tolerance means the
 * same thing everywhere on the map. Simplifying in lng/lat instead would strip
 * detail from Norway and leave Indonesia untouched.
 *
 * Iterative rather than recursive: a few of the 50m rings run to tens of
 * thousands of points, which is enough to blow the call stack.
 */
function simplify(points, tolerance) {
  if (points.length < 3) return points;

  const keep = new Uint8Array(points.length);
  keep[0] = 1;
  keep[points.length - 1] = 1;

  const stack = [[0, points.length - 1]];
  while (stack.length > 0) {
    const [start, end] = stack.pop();
    if (end - start < 2) continue;

    const [ax, ay] = points[start];
    const [bx, by] = points[end];
    const dx = bx - ax;
    const dy = by - ay;
    const len = Math.hypot(dx, dy);

    let maxDist = 0;
    let index = -1;
    for (let i = start + 1; i < end; i++) {
      const [px, py] = points[i];
      const dist =
        len === 0
          ? Math.hypot(px - ax, py - ay)
          : Math.abs(dy * px - dx * py + bx * ay - by * ax) / len;
      if (dist > maxDist) {
        maxDist = dist;
        index = i;
      }
    }

    if (maxDist > tolerance && index !== -1) {
      keep[index] = 1;
      stack.push([start, index], [index, end]);
    }
  }

  return points.filter((_, i) => keep[i] === 1);
}

/** Twice the signed area of a ring, in projected units. Sign is unused. */
function ringArea(points) {
  let sum = 0;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    sum += points[j][0] * points[i][1] - points[i][0] * points[j][1];
  }
  return Math.abs(sum / 2);
}

function ringToPath(points) {
  let d = `M${round(points[0][0])} ${round(points[0][1])}`;
  for (let i = 1; i < points.length; i++) {
    d += `L${round(points[i][0])} ${round(points[i][1])}`;
  }
  return `${d}Z`;
}

/**
 * Rings that survive into the drawing.
 *
 * Anything under MIN_AREA is a rock that renders as a smudge at world zoom and
 * is still a smudge at maximum zoom, so it is dropped -- except where it is a
 * country's *only* ring, because a country that vanishes from the map is worse
 * than a smudge. That exception is what keeps Singapore, Malta and the Pacific
 * island states on it.
 */
const MIN_AREA = 0.5;
const TOLERANCE = 0.45;

/**
 * Countries drawn finer than everyone else.
 *
 * The map zooms, and it zooms to wherever the pins are -- which for this
 * platform means the Philippines, most of the time, filling the frame. At that
 * scale the shared tolerance turns Palawan into a dogleg and Bohol into a
 * triangle. Detail is bought per-country because buying it globally costs
 * ~200 kB to sharpen coastlines nobody is looking at.
 */
const DETAIL = {
  PH: 0.05,
};

/**
 * Cuts a projected ring wherever it jumps the antimeridian.
 *
 * Natural Earth stores Chukotka at longitudes just under +180 and the rest of
 * Russia's east at just over -180, so the projected ring leaps the full width
 * of the map mid-stroke. Drawn as-is that is a scar straight across the Pacific.
 *
 * Two things have to be right or the cure is worse than the disease:
 *
 *  * The ring is rotated to begin immediately after a crossing. A ring is
 *    cyclic, so its stored start point is arbitrary -- splitting without
 *    rotating first makes that arbitrary point a fragment boundary, and
 *    closing *that* fragment draws a chord from Kamchatka to Japan.
 *
 *  * Each fragment is closed against the left or right map edge rather than on
 *    itself, which is where its two ends already were. The closing stroke then
 *    runs down the border, out of sight.
 */
function splitAtSeam(points) {
  const n = points.length;
  const crosses = (a, b) => Math.abs(b[0] - a[0]) > SIZE / 2;

  // The closing edge counts as an edge, hence the modulo.
  let firstCross = -1;
  for (let i = 0; i < n; i++) {
    if (crosses(points[i], points[(i + 1) % n])) {
      firstCross = i;
      break;
    }
  }
  if (firstCross === -1) return [points];

  const rotated = [];
  for (let k = 1; k <= n; k++) rotated.push(points[(firstCross + k) % n]);

  const fragments = [];
  let current = [rotated[0]];
  for (let i = 1; i < rotated.length; i++) {
    if (crosses(rotated[i - 1], rotated[i])) {
      fragments.push(current);
      current = [];
    }
    current.push(rotated[i]);
  }
  fragments.push(current);

  return fragments
    .filter((f) => f.length >= 2)
    // Both ends of a fragment sit against the seam it was cut at, so its first
    // point decides which border the whole fragment belongs to.
    .map((f) => {
      const edge = f[0][0] < SIZE / 2 ? 0 : SIZE;
      return [[edge, f[0][1]], ...f, [edge, f[f.length - 1][1]]];
    });
}

function unprojectX(x) {
  return (x / SIZE) * 360 - 180;
}

function unprojectY(y) {
  const merc = (1 - (2 * y) / SIZE) * Math.PI;
  return ((2 * Math.atan(Math.exp(merc)) - Math.PI / 2) * 180) / Math.PI;
}

function polygonsOf(geometry) {
  if (geometry.type === "Polygon") return [geometry.coordinates];
  if (geometry.type === "MultiPolygon") return geometry.coordinates;
  return [];
}

/**
 * Where a country's pin goes when all we know is the nation.
 *
 * The centroid of the *largest* landmass, not of the country as a whole: an
 * all-territory centroid drops the United States pin in the sea west of
 * British Columbia -- Alaska and Hawaii pulling it off the mainland -- and
 * sends Norway's halfway to the North Pole via Svalbard.
 *
 * Computed in projected space on an already-de-seamed ring, then unprojected,
 * so Russia is not averaged across a 360-degree discontinuity into the Baltic.
 */
function labelPoint(ring) {
  let twice = 0;
  let cx = 0;
  let cy = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const cross = ring[j][0] * ring[i][1] - ring[i][0] * ring[j][1];
    twice += cross;
    cx += (ring[j][0] + ring[i][0]) * cross;
    cy += (ring[j][1] + ring[i][1]) * cross;
  }
  const [x, y] = twice === 0 ? ring[0] : [cx / (3 * twice), cy / (3 * twice)];
  return [unprojectX(x), unprojectY(y)];
}

// ---------------------------------------------------------------------------
// Build
// ---------------------------------------------------------------------------

const topology = JSON.parse(readFileSync(TOPO, "utf8"));
const countries = feature(topology, topology.objects.countries).features;

const paths = [];
const places = [];
let droppedRings = 0;

for (const country of countries) {
  const id = String(country.id ?? "").padStart(3, "0");
  if (SKIP_IDS.has(id)) continue;

  const polygons = polygonsOf(country.geometry);
  if (polygons.length === 0) continue;

  const alpha2 = isoCountries.numericToAlpha2(id) ?? null;
  const name = country.properties?.name ?? alpha2 ?? id;
  const tolerance = (alpha2 && DETAIL[alpha2]) ?? TOLERANCE;

  // Projected rings, largest first, so "the country's only ring" below means
  // its biggest one rather than whichever Natural Earth happened to list first.
  const rings = [];
  for (const polygon of polygons) {
    // Outer ring only. Lesotho and the Vatican are holes in someone else's
    // polygon and are drawn as their own features anyway, and at this scale a
    // fill-rule hole is a pixel.
    const projected = polygon[0].map(([lng, lat]) => [projectX(lng), projectY(lat)]);
    for (const fragment of splitAtSeam(projected)) {
      rings.push({ points: fragment, area: ringArea(fragment) });
    }
  }
  if (rings.length === 0) continue;
  rings.sort((a, b) => b.area - a.area);

  const kept = rings.filter((r, i) => i === 0 || r.area >= MIN_AREA);
  droppedRings += rings.length - kept.length;

  const d = kept.map((r) => ringToPath(simplify(r.points, tolerance))).join("");

  paths.push({ id: alpha2 ?? id, name, d, area: rings[0].area });

  if (alpha2) {
    const [lng, lat] = labelPoint(rings[0].points);
    places.push({ alpha2, name, lat, lng, area: rings[0].area });
  }
}

// One gazetteer row per country, and Natural Earth does not agree that there
// is one feature per country: external territories with their own outline --
// Ashmore and Cartier Islands, mapped to AU -- would otherwise contend for the
// country's slug, and which of them won would come down to file order. The
// largest landmass wins, which is always the country proper.
const byCode = new Map();
for (const place of places) {
  const held = byCode.get(place.alpha2);
  if (!held || place.area > held.area) byCode.set(place.alpha2, place);
}

// `id` is a country code and country codes are NOT unique across features:
// Natural Earth draws Ashmore and Cartier Islands separately from Australia
// and both are AU, and it draws five places nobody agrees are countries --
// Somaliland, Kosovo, Northern Cyprus, Indian Ocean Ter., Siachen Glacier --
// with no ISO id at all, so all five arrive as "000".
//
// React needs one stable unique key per path or it may reconcile the wrong
// shape into the wrong element. So every shape also gets a `key`, which is the
// country code where that is unique and a slug of the name where it is not.
// Sorted largest-first within a code so the country proper comes before its
// outlying territory and keeps the unsuffixed key.
paths.sort((a, b) => a.id.localeCompare(b.id) || b.area - a.area);

const usedKeys = new Map();
for (const path of paths) {
  const base =
    path.id === "000"
      ? path.name
          .normalize("NFD")
          .replace(/[̀-ͯ]/g, "")
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-+|-+$/g, "")
      : path.id;
  const seen = (usedKeys.get(base) ?? 0) + 1;
  usedKeys.set(base, seen);
  path.key = seen === 1 ? base : `${base}-${seen}`;
  delete path.area;
}

places.length = 0;
places.push(...[...byCode.values()].sort((a, b) => a.alpha2.localeCompare(b.alpha2)));

// ---------------------------------------------------------------------------
// Emit: geometry
// ---------------------------------------------------------------------------

const shapeLines = paths
  .map(
    (p) =>
      `  { key: ${JSON.stringify(p.key)}, id: ${JSON.stringify(p.id)}, ` +
      `name: ${JSON.stringify(p.name)}, d: ${JSON.stringify(p.d)} },`,
  )
  .join("\n");

const geometry = `// GENERATED by scripts/generate-world-map.mjs -- do not edit by hand.
//
// Natural Earth 1:50m country outlines, Web Mercator, projected into a
// 1000x1000 square and cropped to the inhabited band. Antarctica is not here.
//
// The projection that produced these coordinates is mirrored in
// ./projection.ts; the two must agree or pins land in the sea.

/** The cropped frame these paths are drawn in, as an SVG viewBox. */
export const WORLD_VIEW_BOX = {
  x: 0,
  y: ${round(VIEW_TOP)},
  width: ${SIZE},
  height: ${round(VIEW_BOTTOM - VIEW_TOP)},
} as const;

export interface CountryShape {
  /**
   * Unique across every shape, and the only thing safe to use as a React key.
   *
   * NOT the same as \`id\`: Natural Earth draws Ashmore and Cartier Islands
   * apart from Australia and calls both AU, and gives five disputed
   * territories no ISO id at all. Those collide on \`id\` and are told apart
   * here.
   */
  key: string;
  /**
   * ISO 3166-1 alpha-2, or the numeric code where no alpha-2 exists. Shared by
   * a country and its outlying territories -- use \`key\` for identity.
   */
  id: string;
  name: string;
  /** One or more closed subpaths, already simplified. */
  d: string;
}

export const WORLD_SHAPES: readonly CountryShape[] = [
${shapeLines}
];
`;

mkdirSync(dirname(GEOMETRY_OUT), { recursive: true });
writeFileSync(GEOMETRY_OUT, geometry);

// ---------------------------------------------------------------------------
// Emit: gazetteer rows
//
// A `values` list rather than a whole migration: it is pasted into
// 0018_map_pins.sql, which owns the table, the aliases and the matcher. The
// aliases are left to the migration too -- "UAE" and "Britain" are not in
// Natural Earth.
// ---------------------------------------------------------------------------

const sqlText = (s) => `'${String(s).replace(/'/g, "''")}'`;
const rows = places
  .map(
    (p) =>
      `  (${sqlText(`country-${p.alpha2.toLowerCase()}`)}, ${sqlText(p.name)}, ` +
      `${sqlText(p.alpha2)}, ${p.lat.toFixed(4)}, ${p.lng.toFixed(4)})`,
  )
  .join(",\n");

mkdirSync(dirname(PLACES_OUT), { recursive: true });
writeFileSync(
  PLACES_OUT,
  `-- GENERATED by scripts/generate-world-map.mjs -- paste into the migration.\n` +
    `-- (slug, name, country_code, lat, lng)\n${rows}\n`,
);

// ---------------------------------------------------------------------------
// Emit: country aliases
//
// Natural Earth names countries the way a cartographer fits them on a map --
// "Dem. Rep. Congo", "Eq. Guinea", "S. Sudan", "Bosnia and Herz." -- and
// nobody writes their address that way. Left at that, the gazetteer does not
// merely miss those answers, it actively mis-files five of them: "South Sudan"
// matched Sudan, "Equatorial Guinea" matched Guinea, "Democratic Republic of
// the Congo" matched the Republic of the Congo, and each one put a pin in the
// wrong country. (The longest-term rule cannot save you when the only term the
// gazetteer holds for a country is an abbreviation the answer does not
// contain.)
//
// So every country also carries the names ISO 3166 gives it, in the word order
// people actually use. Generated rather than hand-listed, because the failure
// mode of a hand-listed one is the country nobody thought to check.
// ---------------------------------------------------------------------------

/**
 * The same folding normalize_location() does in SQL, near enough for aliases:
 * the trigger normalises them again on the way into map_place_terms, so this
 * only has to avoid emitting anything that would round-trip differently.
 */
function normalizeAlias(value) {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

// Every country's own name, so an alias can be stopped from stealing one.
// ISO lists bare "Congo" among the names for the Democratic Republic of the
// Congo, and "Congo" is the actual name of the country next door -- left in,
// it is a coin flip which of the two an answer saying "Congo" lands on. A name
// belongs to the country whose name it is.
const ownNames = new Set(places.map((p) => normalizeAlias(p.name)));

const aliasRows = [];
for (const place of places) {
  const own = normalizeAlias(place.name);
  const names = new Set();

  const primary = isoCountries.getName(place.alpha2, "en");
  if (primary) names.add(primary);
  for (const alt of isoCountries.getNames("en", { select: "all" })[place.alpha2] ?? []) {
    names.add(alt);
  }

  // Deduped AFTER normalising, not before: ISO lists "Åland Islands" and
  // "Aland Islands" as distinct names and they fold to the same key.
  const aliases = [
    ...new Set(
      [...names]
        .map(normalizeAlias)
        // Its own name is already a search term; two-character floor because
        // the matcher ignores anything shorter, and dropping it here keeps the
        // stored data honest about what can actually match.
        .filter(
          (alias) =>
            alias &&
            alias !== own &&
            alias.length >= 2 &&
            // Never claim a name that is another country's own name.
            !ownNames.has(alias),
        ),
    ),
  ].sort();

  if (aliases.length > 0) {
    aliasRows.push(
      `  (${sqlText(place.alpha2)}, array[${aliases.map(sqlText).join(", ")}])`,
    );
  }
}

writeFileSync(
  ALIASES_OUT,
  `-- GENERATED by scripts/generate-world-map.mjs -- paste into the migration.\n` +
    `-- (country_code, additional aliases)\n${aliasRows.join(",\n")}\n`,
);

const kb = (n) => `${(n / 1024).toFixed(1)} kB`;
console.log(
  `world-geometry.ts  ${paths.length} countries, ${kb(geometry.length)}` +
    ` (${droppedRings} tiny rings dropped)`,
);
console.log(`country-places.sql ${places.length} countries`);
console.log(`country-aliases.sql ${aliasRows.length} countries with ISO aliases`);
