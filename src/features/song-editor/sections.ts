import type { EditableSection } from "./types";

export function makeKey() {
  return crypto.randomUUID();
}

/**
 * Numbers by how many verses already exist rather than by array position, so
 * adding a verse after a chorus gives "Verse 2" instead of "Verse 3".
 */
export function emptySection(existing: EditableSection[]): EditableSection {
  const verseCount = existing.filter((s) => s.type === "verse").length;
  return {
    key: makeKey(),
    type: "verse",
    title: `Verse ${verseCount + 1}`,
    lyrics: "",
  };
}
