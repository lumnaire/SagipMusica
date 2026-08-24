import type { Song, WorshipSet } from "@/types/database";
import type { WorshipSetItemWithTitle, WorshipSetListItem } from "@shared/contract";
import { invoke } from "./invoke";

export type { WorshipSetListItem, WorshipSetItemWithTitle };

/** Desktop stand-in for src/features/worship-sets/api.ts. */

export function fetchWorshipSets(): Promise<WorshipSetListItem[]> {
  return invoke("sets.list");
}

export function fetchWorshipSetDetail(setId: string): Promise<{
  set: WorshipSet;
  items: WorshipSetItemWithTitle[];
}> {
  return invoke("sets.get", { setId });
}

export function createWorshipSet(name: string, description: string): Promise<WorshipSet> {
  return invoke("sets.create", { name, description });
}

export function updateWorshipSet(
  setId: string,
  name: string,
  description: string,
): Promise<WorshipSet> {
  return invoke("sets.update", { setId, name, description });
}

export async function deleteWorshipSet(setId: string): Promise<void> {
  await invoke("sets.delete", { setId });
}

/** Replaces the full ordered song list for a worship set, in one transaction. */
export async function saveWorshipSetItems(setId: string, songIds: string[]): Promise<void> {
  await invoke("sets.saveItems", { setId, songIds });
}

export function fetchAllSongsForPicker(): Promise<
  Pick<Song, "id" | "title" | "author" | "category">[]
> {
  return invoke("songs.picker");
}
