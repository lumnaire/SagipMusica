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
  signUp: (
    email: string,
    password: string,
    name: string,
  ) => Promise<{ error: string | null; needsVerification: boolean }>;
  signInWithOAuth: (provider: "google") => Promise<{ error: string | null }>;
  resendVerification: (email: string) => Promise<{ error: string | null }>;
  refreshProfile: () => Promise<void>;
  updateName: (name: string) => Promise<{ error: string | null }>;
  updateEmail: (email: string) => Promise<{ error: string | null }>;
  updatePassword: (password: string) => Promise<{ error: string | null }>;
  deleteAccount: () => Promise<{ error: string | null }>;
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

/**
 * Minimum password length. Enforced here rather than only via the form's
 * `minLength`, which is trivially bypassed. Supabase enforces its own minimum
 * server-side; keep the two in step (Authentication > Providers > Email).
 */
export const MIN_PASSWORD_LENGTH = 8;

const TOO_SHORT = `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`;

let initialized = false;

// A session can outlive the account it points to -- e.g. the user (and
// their profiles row) was deleted from the Supabase dashboard, but the
// browser still has a cached, technically-unexpired session in
// localStorage. Treat "session exists but profile lookup finds nothing" as
// effectively logged out rather than as an authenticated user with no
// profile, which every other part of the app assumes can't happen.
async function applySession(
  session: Session | null,
  set: (state: Partial<AuthState>) => void,
) {
  if (!session) {
    set({ session: null, profile: null, status: "unauthenticated" });
    return;
  }
  const profile = await fetchProfile(session.user.id);
  if (!profile) {
    await supabase.auth.signOut();
    set({ session: null, profile: null, status: "unauthenticated" });
    return;
  }
  set({ session, profile, status: "authenticated" });
}

export const useAuthStore = create<AuthState>((set, get) => ({
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
    await applySession(session, set);

    supabase.auth.onAuthStateChange(async (_event, session) => {
      await applySession(session, set);
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

  signUp: async (email, password, name) => {
    set({ error: null });
    if (password.length < MIN_PASSWORD_LENGTH) {
      set({ error: TOO_SHORT });
      return { error: TOO_SHORT, needsVerification: false };
    }
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { name },
        emailRedirectTo: `${window.location.origin}/dashboard`,
      },
    });
    if (error) {
      set({ error: error.message });
      return { error: error.message, needsVerification: false };
    }
    return { error: null, needsVerification: !data.session };
  },

  signInWithOAuth: async (provider) => {
    set({ error: null });
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: `${window.location.origin}/dashboard` },
    });
    if (error) {
      set({ error: error.message });
      return { error: error.message };
    }
    return { error: null };
  },

  resendVerification: async (email) => {
    const { error } = await supabase.auth.resend({ type: "signup", email });
    if (error) return { error: error.message };
    return { error: null };
  },

  refreshProfile: async () => {
    const userId = get().session?.user.id;
    if (!userId) return;
    const profile = await fetchProfile(userId);
    set({ profile });
  },

  updateName: async (name) => {
    const userId = get().session?.user.id;
    if (!userId) return { error: "Not signed in." };
    const { error } = await supabase.from("profiles").update({ name }).eq("id", userId);
    if (error) return { error: error.message };
    const profile = get().profile;
    if (profile) set({ profile: { ...profile, name } });
    return { error: null };
  },

  updateEmail: async (email) => {
    const { error } = await supabase.auth.updateUser({ email });
    if (error) return { error: error.message };
    return { error: null };
  },

  updatePassword: async (password) => {
    if (password.length < MIN_PASSWORD_LENGTH) return { error: TOO_SHORT };
    const { error } = await supabase.auth.updateUser({ password });
    if (error) return { error: error.message };
    return { error: null };
  },

  deleteAccount: async () => {
    const { error } = await supabase.rpc("delete_own_account");
    if (error) return { error: error.message };
    await supabase.auth.signOut();
    set({ session: null, profile: null, status: "unauthenticated" });
    return { error: null };
  },

  signOut: async () => {
    await supabase.auth.signOut();
    set({ session: null, profile: null, status: "unauthenticated" });
  },
}));
