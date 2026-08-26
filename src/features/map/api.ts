import { supabase } from "@/lib/supabase/client";

/**
 * A point on the map, as the public landing page sees it.
 *
 * A place and two counts -- never a church, an account or the raw text
 * somebody typed. See migration 0018.
 */
export interface MapPin {
  slug: string;
  /** "Cebu", "Thailand". Not qualified by country; `country_name` is separate. */
  name: string;
  country_name: string;
  kind: "country" | "region" | "province" | "custom";
  lat: number;
  lng: number;
  /** Web signups whose onboarding answer resolved here. */
  churches: number;
  /** Desktop download survey answers that resolved here. */
  downloads: number;
}

/** The same pins as the operator sees them, plus what they can act on. */
export interface AdminMapPin extends MapPin {
  id: string;
  country_code: string | null;
  source: "seed" | "manual";
  is_hidden: boolean;
  aliases: string[];
}

/**
 * One distinct location answer, and what the matcher made of it.
 *
 * The review list: this is where a wrong reading becomes visible, because the
 * text as typed sits next to the place it was read as.
 */
export interface MapLocationReview {
  location_key: string;
  /** One real answer for this key, un-normalised. */
  sample: string;
  churches: number;
  downloads: number;
  place_id: string | null;
  place_name: string | null;
  place_slug: string | null;
  /** True when a superadmin ruled on this text rather than the matcher. */
  is_assigned: boolean;
  /** True when that ruling was "keep it off the map". */
  is_ignored: boolean;
}

/** A gazetteer entry, for the pickers that reassign a location to one. */
export interface MapPlaceOption {
  id: string;
  slug: string;
  name: string;
  kind: MapPin["kind"];
  country_code: string | null;
}

/**
 * Every pin on the public map. Readable signed out.
 *
 * A SECURITY DEFINER function rather than a table read: churches and
 * download_signups stay closed to anon, and only the aggregate comes back.
 */
export async function fetchMapPins(): Promise<MapPin[]> {
  const { data, error } = await supabase.rpc("public_map_pins");
  if (error) throw error;
  return (data ?? []) as MapPin[];
}

// Everything below re-checks is_superadmin() server-side, so a non-superadmin
// calling it directly gets "Not authorised" rather than data.

export async function fetchAdminMapPins(): Promise<AdminMapPin[]> {
  const { data, error } = await supabase.rpc("superadmin_map_pins");
  if (error) throw error;
  return (data ?? []) as AdminMapPin[];
}

export async function fetchMapLocationReview(): Promise<MapLocationReview[]> {
  const { data, error } = await supabase.rpc("superadmin_map_locations");
  if (error) throw error;
  return (data ?? []) as MapLocationReview[];
}

/**
 * The gazetteer, for the "put this somewhere else" picker.
 *
 * Ordered so the Philippine provinces -- what almost every correction needs --
 * come before 234 countries.
 */
export async function fetchMapPlaces(): Promise<MapPlaceOption[]> {
  const { data, error } = await supabase
    .from("map_places")
    .select("id, slug, name, kind, country_code")
    .order("kind", { ascending: true })
    .order("name", { ascending: true });
  if (error) throw error;
  return (data ?? []) as MapPlaceOption[];
}

export interface NewMapPin {
  name: string;
  lat: number;
  lng: number;
  /**
   * The raw answer this pin is being created FOR, if any.
   *
   * Set when an operator is placing an answer the matcher could not read: the
   * pin is created and that answer is pointed at it together. Left off when
   * they are simply dropping a pin somewhere.
   */
  forLocationKey?: string | null;
}

/**
 * Adds a pin by hand, optionally placing an unreadable answer on it.
 *
 * One RPC rather than an insert followed by an upsert, because those are two
 * writes with no transaction around them: a failure between them leaves a pin
 * on the public map that nobody asked for and an answer still unplaced. The
 * function does both or neither. It also stamps `source: 'manual'`, which is
 * what makes the pin show with nothing counted behind it -- placing a pin by
 * hand IS the decision to show it.
 */
export async function addMapPin(pin: NewMapPin): Promise<string> {
  const { data, error } = await supabase.rpc("superadmin_add_map_pin", {
    pin_name: pin.name,
    pin_lat: pin.lat,
    pin_lng: pin.lng,
    for_location_key: pin.forLocationKey ?? null,
  });
  if (error) throw error;
  return data as string;
}

/** Moves an existing pin. Used to drag a mis-seeded place to where it belongs. */
export async function moveMapPlace(id: string, lat: number, lng: number): Promise<void> {
  const { error } = await supabase.from("map_places").update({ lat, lng }).eq("id", id);
  if (error) throw error;
}

/**
 * Takes a pin off the public map, or puts it back.
 *
 * Not a delete: the locations that resolved here still resolve here, they just
 * stop being drawn. Deleting a seeded place would send every church in it back
 * into the unresolved pile, which is a much bigger change than "don't show
 * this".
 */
export async function setMapPlaceHidden(id: string, hidden: boolean): Promise<void> {
  const { error } = await supabase.from("map_places").update({ is_hidden: hidden }).eq("id", id);
  if (error) throw error;
}

/** Removes a hand-added pin outright. Only ever offered for `source: 'manual'`. */
export async function deleteMapPlace(id: string): Promise<void> {
  const { error } = await supabase.from("map_places").delete().eq("id", id);
  if (error) throw error;
}

/**
 * Rules on one raw location answer.
 *
 * `placeId` null means "keep this off the map" -- a test row, or an answer too
 * vague to place honestly. That is different from clearing the ruling
 * altogether, which hands the text back to the matcher.
 */
export async function assignMapLocation(
  locationKey: string,
  placeId: string | null,
): Promise<void> {
  const { error } = await supabase
    .from("map_location_assignments")
    .upsert({ location_key: locationKey, place_id: placeId }, { onConflict: "location_key" });
  if (error) throw error;
}

export async function clearMapLocationAssignment(locationKey: string): Promise<void> {
  const { error } = await supabase
    .from("map_location_assignments")
    .delete()
    .eq("location_key", locationKey);
  if (error) throw error;
}
