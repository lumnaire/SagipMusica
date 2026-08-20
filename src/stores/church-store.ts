import { create } from "zustand";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase/client";
import { applyBrandColor } from "@/lib/branding";
import type { Church } from "@/types/database";

interface ChurchState {
  church: Church | null;
  loading: boolean;
  loadChurch: (churchId: string) => Promise<void>;
  updateName: (name: string) => Promise<{ error: string | null }>;
  updateAccentColor: (hex: string) => Promise<{ error: string | null }>;
  clear: () => void;
}

export const useChurchStore = create<ChurchState>((set, get) => ({
  church: null,
  loading: false,

  loadChurch: async (churchId) => {
    set({ loading: true });
    const { data, error } = await supabase
      .from("churches")
      .select("*")
      .eq("id", churchId)
      .single();
    if (error) {
      console.error("Failed to load church", error);
      set({ loading: false });
      return;
    }
    const church = data as Church;
    set({ church, loading: false });
    applyBrandColor(church.accent_color);
  },

  updateName: async (name) => {
    const church = get().church;
    if (!church) return { error: "No church loaded" };

    const { error } = await supabase.from("churches").update({ name }).eq("id", church.id);
    if (error) {
      toast.error("Couldn't save the church name. Please try again.");
      return { error: error.message };
    }

    set({ church: { ...church, name } });
    return { error: null };
  },

  updateAccentColor: async (hex) => {
    const previous = get().church;
    if (!previous) return { error: "No church loaded" };

    applyBrandColor(hex);
    set({ church: { ...previous, accent_color: hex } });

    const { error } = await supabase
      .from("churches")
      .update({ accent_color: hex })
      .eq("id", previous.id);

    if (error) {
      applyBrandColor(previous.accent_color);
      set({ church: previous });
      toast.error("Couldn't save your color. Please try again.");
      return { error: error.message };
    }

    return { error: null };
  },

  clear: () => {
    set({ church: null, loading: false });
  },
}));
