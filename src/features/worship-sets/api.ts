import { supabase } from "@/lib/supabase/client";
import type { Song, WorshipSet, WorshipSetItem } from "@/types/database";

export interface WorshipSetListItem extends WorshipSet {
  item_count: number;
}

export async function fetchWorshipSets(): Promise<WorshipSetListItem[]> {
  const { data, error } = await supabase
    .from("worship_sets")
    .select("*, worship_set_items(count)")
    .order("updated_at", { ascending: false });
  if (error) throw error;

  type Row = WorshipSet & { worship_set_items: { count: number }[] };
  return ((data ?? []) as unknown as Row[]).map((row) => ({
    ...row,
    item_count: row.worship_set_items?.[0]?.count ?? 0,
  }));
}

export interface WorshipSetItemWithTitle extends WorshipSetItem {
  song: Pick<Song, "id" | "title" | "author" | "category">;
}

export async function fetchWorshipSetDetail(setId: string): Promise<{
  set: WorshipSet;
  items: WorshipSetItemWithTitle[];
}> {
  const { data: set, error: setError } = await supabase
    .from("worship_sets")
    .select("*")
    .eq("id", setId)
    .single();
  if (setError) throw setError;

  const { data: items, error: itemsError } = await supabase
    .from("worship_set_items")
    .select("*, song:songs(id, title, author, category)")
    .eq("set_id", setId)
    .order("order_index", { ascending: true });
  if (itemsError) throw itemsError;

  return { set: set as WorshipSet, items: (items ?? []) as unknown as WorshipSetItemWithTitle[] };
}

export async function createWorshipSet(name: string, description: string): Promise<WorshipSet> {
  const { data, error } = await supabase
    .from("worship_sets")
    .insert({ name, description: description || null })
    .select()
    .single();
  if (error) throw error;
  return data as WorshipSet;
}

export async function updateWorshipSet(
  setId: string,
  name: string,
  description: string,
): Promise<WorshipSet> {
  const { data, error } = await supabase
    .from("worship_sets")
    .update({ name, description: description || null })
    .eq("id", setId)
    .select()
    .single();
  if (error) throw error;
  return data as WorshipSet;
}

export async function deleteWorshipSet(setId: string): Promise<void> {
  const { error } = await supabase.from("worship_sets").delete().eq("id", setId);
  if (error) throw error;
}

/** Replaces the full ordered song list for a worship set. */
export async function saveWorshipSetItems(setId: string, songIds: string[]): Promise<void> {
  const { error: deleteError } = await supabase
    .from("worship_set_items")
    .delete()
    .eq("set_id", setId);
  if (deleteError) throw deleteError;

  if (songIds.length === 0) return;

  const { error: insertError } = await supabase.from("worship_set_items").insert(
    songIds.map((songId, index) => ({
      set_id: setId,
      song_id: songId,
      order_index: index,
    })),
  );
  if (insertError) throw insertError;
}

export async function fetchAllSongsForPicker(): Promise<
  Pick<Song, "id" | "title" | "author" | "category">[]
> {
  const { data, error } = await supabase
    .from("songs")
    .select("id, title, author, category")
    .order("title", { ascending: true });
  if (error) throw error;
  return data ?? [];
}
