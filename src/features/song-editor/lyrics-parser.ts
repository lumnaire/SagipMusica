import type { SectionType } from "@/types/database";

export interface ParsedSection {
  type: SectionType;
  title: string;
  lyrics: string;
}

export interface ParseOptions {
  /** Drop chord-only lines and CCLI/copyright footers. Default true. */
  stripChords?: boolean;
}

/**
 * Words people actually write above a stanza, mapped to the section types the
 * database allows. SectionType has no pre-chorus/tag/vamp, so those become
 * "custom" and keep their label as the section title.
 */
const LABEL_TYPES: Record<string, SectionType> = {
  verse: "verse",
  chorus: "chorus",
  refrain: "refrain",
  bridge: "bridge",
  intro: "intro",
  outro: "outro",
  ending: "outro",
  coda: "outro",
  "pre-chorus": "custom",
  "pre chorus": "custom",
  prechorus: "custom",
  tag: "custom",
  vamp: "custom",
  interlude: "custom",
};

/** Display casing for a matched label word. */
const LABEL_TITLES: Record<string, string> = {
  verse: "Verse",
  chorus: "Chorus",
  refrain: "Refrain",
  bridge: "Bridge",
  intro: "Intro",
  outro: "Outro",
  ending: "Ending",
  coda: "Coda",
  "pre-chorus": "Pre-Chorus",
  "pre chorus": "Pre-Chorus",
  prechorus: "Pre-Chorus",
  tag: "Tag",
  vamp: "Vamp",
  interlude: "Interlude",
};

/** Single letters are only a label with a number or colon: "V1", "C:". */
const SHORT_LABEL_TYPES: Record<string, { type: SectionType; title: string }> = {
  v: { type: "verse", title: "Verse" },
  c: { type: "chorus", title: "Chorus" },
  b: { type: "bridge", title: "Bridge" },
};

const CHORD_TOKEN = /^[A-G](#|b)?(maj|min|m|dim|aug|sus|add)?\d*(\/[A-G](#|b)?)?$/;

interface Label {
  type: SectionType;
  title: string;
}

/**
 * Returns the label if this line is *only* a section heading, else null.
 * Tolerates "[Verse 1]", "(Chorus)", "Verse 1:", "VERSE 2".
 */
export function matchLabel(line: string): Label | null {
  const cleaned = line
    .trim()
    .replace(/^[[(\s]+/, "")
    .replace(/[\])\s:.\-–]+$/, "")
    .trim();
  if (!cleaned) return null;

  // "Verse 1" / "Chorus" / "Pre-Chorus 2"
  const full = /^([A-Za-z][A-Za-z\s-]*?)\s*(\d+)?$/.exec(cleaned);
  if (full) {
    const word = full[1].trim().toLowerCase();
    const num = full[2];
    const type = LABEL_TYPES[word];
    if (type) {
      const base = LABEL_TITLES[word];
      return { type, title: num ? `${base} ${num}` : base };
    }
  }

  // "V1" / "C:" / "B2" -- only with a number, or a colon that the trim above
  // already removed. A bare "C" on its own is a lyric, not a label.
  const short = /^([VvCcBb])\s*(\d+)?$/.exec(cleaned);
  if (short) {
    const hadNumber = !!short[2];
    const hadColon = /[:.]\s*$/.test(line.trim());
    if (hadNumber || hadColon) {
      const entry = SHORT_LABEL_TYPES[short[1].toLowerCase()];
      return {
        type: entry.type,
        title: hadNumber ? `${entry.title} ${short[2]}` : entry.title,
      };
    }
  }

  return null;
}

/** True when every token on the line is a chord, e.g. "G  D/F#  Em7". */
export function isChordLine(line: string): boolean {
  const tokens = line.trim().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return false;
  return tokens.every((t) => t === "N.C." || CHORD_TOKEN.test(t));
}

function isNoise(line: string): boolean {
  const t = line.trim();
  return /^ccli\b/i.test(t) || t.startsWith("©") || /^copyright\b/i.test(t);
}

/**
 * Splits a pasted song into sections.
 *
 * Blocks are separated by blank lines. A block whose first line is a section
 * label takes its type from that label; anything else is treated as a verse and
 * numbered in sequence. A block that is nothing but a label attaches to the
 * block that follows it, which is what happens when someone leaves a blank line
 * under "Chorus".
 */
export function parseSongText(raw: string, opts: ParseOptions = {}): ParsedSection[] {
  const { stripChords = true } = opts;
  if (!raw || !raw.trim()) return [];

  const lines = raw.replace(/\r\n?/g, "\n").split("\n").map((l) => l.trimEnd());

  // Group into blocks on blank lines.
  const blocks: string[][] = [];
  let current: string[] = [];
  for (const line of lines) {
    if (line.trim() === "") {
      if (current.length) blocks.push(current);
      current = [];
    } else {
      current.push(line);
    }
  }
  if (current.length) blocks.push(current);

  const sections: ParsedSection[] = [];
  let verseCount = 0;
  // Set when a block was nothing but a heading, to apply to the next block.
  let carriedLabel: Label | null = null;

  for (const block of blocks) {
    let body = block;
    let label: Label | null = carriedLabel;
    carriedLabel = null;

    if (!label) {
      const first = matchLabel(block[0]);
      if (first) {
        label = first;
        body = block.slice(1);
      }
    }

    if (stripChords) {
      body = body.filter((l) => !isChordLine(l) && !isNoise(l));
    }

    const lyrics = body.join("\n").trim();

    // A heading with nothing under it: hold it for the next block.
    if (!lyrics) {
      if (label) carriedLabel = label;
      continue;
    }

    if (label) {
      sections.push({ type: label.type, title: label.title, lyrics });
      if (label.type === "verse") verseCount += 1;
    } else {
      verseCount += 1;
      sections.push({ type: "verse", title: `Verse ${verseCount}`, lyrics });
    }
  }

  return sections;
}
