import type { SectionType, SectionMedia } from "@/types/database";

export interface EditableSection {
  key: string; // stable client-side key (crypto.randomUUID()), independent of DB id
  id?: string; // present once persisted
  type: SectionType;
  title: string;
  lyrics: string;
  media: SectionMedia | null;
}
