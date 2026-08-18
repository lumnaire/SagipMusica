import { create } from "zustand";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase/client";
import type { Profile } from "@/types/database";

interface AuthState {
  session: Session | null;
  profile: Profile | null;
  status: "loading" | "authenticated" | "unauthenticated";
  error: string | null;
  initialize: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
}

async function fetchProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .single();
  if (error) {
    console.error("Failed to load profile", error);
    return null;
  }
  return data as Profile;
}

let initialized = false;

export const useAuthStore = create<AuthState>((set) => ({
  session: null,
  profile: null,
  status: "loading",
  error: null,

  initialize: async () => {
    if (initialized) return;
    initialized = true;

    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (session) {
      const profile = await fetchProfile(session.user.id);
      set({ session, profile, status: "authenticated" });
    } else {
      set({ session: null, profile: null, status: "unauthenticated" });
    }

    supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session) {
        const profile = await fetchProfile(session.user.id);
        set({ session, profile, status: "authenticated" });
      } else {
        set({ session: null, profile: null, status: "unauthenticated" });
      }
    });
  },

  signIn: async (email, password) => {
    set({ error: null });
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      set({ error: error.message });
      return { error: error.message };
    }
    return { error: null };
  },

  signOut: async () => {
    await supabase.auth.signOut();
    set({ session: null, profile: null, status: "unauthenticated" });
  },
}));
