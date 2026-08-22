import { supabase } from "@/lib/supabase/client";
import { saveSections, type SectionFormValues } from "@/lib/save-sections";
import type { SongFormValues } from "@/features/songs/api";
import type {
  CopyrightStatus,
  HymnTemplate,
  HymnTemplateSection,
  HymnTemplateWithSections,
  TemplateStatus,
} from "@/types/database";

// Writes here go through ordinary RLS policies rather than SECURITY DEFINER
// RPCs. That is safe because a template is invisible to church admins until it
// is published, so a save that fails halfway leaves a broken draft rather than
// a broken song in somebody's hymnal. See supabase/migrations/0012_song_encoder.sql.

export interface TemplateFormValues extends SongFormValues {
  copyright_status: CopyrightStatus;
}

/** A catalog row plus its stanza count, for the list page. */
export interface TemplateListItem extends HymnTemplate {
  section_count: number;
}

export async function listTemplates(): Promise<TemplateListItem[]> {
  const { data, error } = await supabase
    .from("hymn_templates")
    .select("*, hymn_template_sections(count)")
    .order("updated_at", { ascending: false });
  if (error) throw error;

  return (data ?? []).map((row) => {
    const { hymn_template_sections, ...template } = row as HymnTemplate & {
      hymn_template_sections: { count: number }[];
    };
    return {
      ...template,
      section_count: hymn_template_sections?.[0]?.count ?? 0,
    };
  });
}

export async function fetchTemplateWithSections(
  templateId: string,
): Promise<HymnTemplateWithSections> {
  const { data: template, error: templateError } = await supabase
    .from("hymn_templates")
    .select("*")
    .eq("id", templateId)
    .single();
  if (templateError) throw templateError;

  const { data: sections, error: sectionsError } = await supabase
    .from("hymn_template_sections")
    .select("*")
    .eq("template_id", templateId)
    .order("order_index", { ascending: true });
  if (sectionsError) throw sectionsError;

  return {
    ...(template as HymnTemplate),
    sections: (sections ?? []) as HymnTemplateSection[],
  };
}

function toRow(values: TemplateFormValues) {
  return {
    title: values.title,
    author: values.author || null,
    composer: values.composer || null,
    category: values.category || null,
    key: values.key || null,
    tempo: values.tempo || null,
    description: values.description || null,
    copyright_status: values.copyright_status,
  };
}

export async function createTemplate(values: TemplateFormValues): Promise<HymnTemplate> {
  const { data: session } = await supabase.auth.getSession();
  const { data, error } = await supabase
    .from("hymn_templates")
    .insert({ ...toRow(values), updated_by: session.session?.user.id ?? null })
    .select()
    .single();
  if (error) throw error;
  return data as HymnTemplate;
}

export async function updateTemplate(
  templateId: string,
  values: TemplateFormValues,
): Promise<HymnTemplate> {
  const { data: session } = await supabase.auth.getSession();
  const { data, error } = await supabase
    .from("hymn_templates")
    .update({ ...toRow(values), updated_by: session.session?.user.id ?? null })
    .eq("id", templateId)
    .select()
    .single();
  if (error) throw error;
  return data as HymnTemplate;
}

export async function deleteTemplate(templateId: string): Promise<void> {
  const { error } = await supabase.from("hymn_templates").delete().eq("id", templateId);
  if (error) throw error;
}

/**
 * Publishing is what makes a template visible to church admins. Unpublishing
 * hides it from the library but does not touch copies churches already took —
 * those are theirs.
 */
export async function setTemplateStatus(
  templateId: string,
  status: TemplateStatus,
): Promise<void> {
  const { error } = await supabase
    .from("hymn_templates")
    .update({ status })
    .eq("id", templateId);
  if (error) throw error;
}

export async function saveTemplateSections(
  templateId: string,
  sections: SectionFormValues[],
  existingIds: string[],
): Promise<HymnTemplateSection[]> {
  return saveSections<HymnTemplateSection>({
    table: "hymn_template_sections",
    parentColumn: "template_id",
    parentId: templateId,
    sections,
    existingIds,
  });
}
