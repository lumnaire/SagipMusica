import { create } from "zustand";
import { toast } from "sonner";
import { applyBrandColor } from "@/lib/branding";
import type { Church } from "@/types/database";
import { invoke } from "./invoke";

/**
 * Desktop stand-in for src/stores/church-store.ts.
 *
 * Identical surface and identical optimistic-update behaviour — the accent
 * colour is applied to the CSS variables immediately and rolled back if the
 * write fails. `loadChurch` still takes a churchId so the caller is unchanged,
 * but the local database holds exactly one church and main resolves it.
 */
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

  loadChurch: async () => {
    set({ loading: true });
    try {
      const church = await invoke("church.get");
      set({ church, loading: false });
      applyBrandColor(church.accent_color);
    } catch (err) {
      console.error("Failed to load church", err);
      set({ loading: false });
    }
  },

  updateName: async (name) => {
    const church = get().church;
    if (!church) return { error: "No church loaded" };

    try {
      await invoke("church.update", { patch: { name } });
    } catch (err) {
      toast.error("Couldn't save the church name. Please try again.");
      return { error: err instanceof Error ? err.message : "Save failed." };
    }

    set({ church: { ...church, name } });
    return { error: null };
  },

  updateAccentColor: async (hex) => {
    const previous = get().church;
    if (!previous) return { error: "No church loaded" };

    applyBrandColor(hex);
    set({ church: { ...previous, accent_color: hex } });

    try {
      await invoke("church.update", { patch: { accent_color: hex } });
    } catch (err) {
      applyBrandColor(previous.accent_color);
      set({ church: previous });
      toast.error("Couldn't save your color. Please try again.");
      return { error: err instanceof Error ? err.message : "Save failed." };
    }

    return { error: null };
  },

  clear: () => {
    set({ church: null, loading: false });
  },
}));
