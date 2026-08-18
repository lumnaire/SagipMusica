import { supabase, MEDIA_BUCKET } from "@/lib/supabase/client";
import type { SectionMedia, CropConfig, MediaType } from "@/types/database";

function extensionFor(file: File): string {
  const fromName = file.name.split(".").pop();
  if (fromName && fromName.length <= 5) return fromName.toLowerCase();
  const fromType = file.type.split("/").pop();
  return fromType ?? "png";
}

export async function uploadNotationImage(
  songId: string,
  sectionId: string,
  file: File,
): Promise<string> {
  const ext = extensionFor(file);
  const path = `songs/${songId}/${sectionId}/original-${Date.now()}.${ext}`;

  const { error } = await supabase.storage.from(MEDIA_BUCKET).upload(path, file, {
    cacheControl: "3600",
    upsert: false,
  });
  if (error) throw error;
  return path;
}

export function getMediaPublicUrl(storagePath: string): string {
  const { data } = supabase.storage.from(MEDIA_BUCKET).getPublicUrl(storagePath);
  return data.publicUrl;
}

export async function createSectionMedia(
  sectionId: string,
  storagePath: string,
  mediaType: MediaType,
  crop: CropConfig,
): Promise<SectionMedia> {
  const { data, error } = await supabase
    .from("section_media")
    .insert({
      section_id: sectionId,
      storage_path: storagePath,
      media_type: mediaType,
      crop_x: crop.x,
      crop_y: crop.y,
      crop_width: crop.width,
      crop_height: crop.height,
      scale: crop.scale,
      position_x: 0.5,
      position_y: 0.5,
    })
    .select()
    .single();
  if (error) throw error;
  return data as SectionMedia;
}

export async function updateSectionMediaCrop(
  mediaId: string,
  crop: CropConfig,
): Promise<SectionMedia> {
  const { data, error } = await supabase
    .from("section_media")
    .update({
      crop_x: crop.x,
      crop_y: crop.y,
      crop_width: crop.width,
      crop_height: crop.height,
      scale: crop.scale,
    })
    .eq("id", mediaId)
    .select()
    .single();
  if (error) throw error;
  return data as SectionMedia;
}

export async function deleteSectionMedia(mediaId: string, storagePath: string): Promise<void> {
  const { error: storageError } = await supabase.storage
    .from(MEDIA_BUCKET)
    .remove([storagePath]);
  if (storageError) console.error("Failed to remove storage object", storageError);

  const { error } = await supabase.from("section_media").delete().eq("id", mediaId);
  if (error) throw error;
}
