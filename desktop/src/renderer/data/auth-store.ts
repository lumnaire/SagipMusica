import { create } from "zustand";
import type { Profile } from "@/types/database";
import { invoke } from "./invoke";

/**
 * Desktop stand-in for src/stores/auth-store.ts.
 *
 * There are no accounts on this build — the database is on the user's own
 * machine and there is nobody to authenticate against. So this store is not an
 * auth store at all: it loads the single local profile row and reports it as
 * permanently signed in with the `admin` role, which is what the reused pages
 * check before showing edit and delete controls.
 *
 * `session` exists only because AppShell reads `session?.user.email` for the
 * avatar fallback. It is shaped like the Supabase session at exactly that
 * depth and no further.
 */
interface LocalSession {
  user: { id: string; email: string };
}

interface AuthState {
  session: LocalSession | null;
  profile: Profile | null;
  status: "loading" | "authenticated" | "unauthenticated";
  /**
   * Whether the first-run wizard has been through. Kept beside the profile
   * rather than on it: `Profile` is the web app's shape and has no such field,
   * and widening a shared type for one build's private state would leak the
   * desktop's flow into every page that reads a profile.
   */
  setupCompleted: boolean;
  /** Records the wizard's answers and marks it done. */
  completeSetup: (answers: { name: string }) => Promise<void>;
  initialize: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  updateName: (name: string) => Promise<{ error: string | null }>;
  /**
   * Kept so the shared AppShell type-checks. Signing out of a local database
   * would mean nothing, so it does nothing — the desktop AppShell does not
   * render the control that calls it.
   */
  signOut: () => Promise<void>;
}

/**
 * A local install has one user who owns the machine and the file, so they get
 * the role that unlocks every editing control. There is no server to enforce
 * anything against and nothing to escalate to.
 */
const LOCAL_ROLE = "admin" as const;

/** The desktop identity, widened to the Profile shape the UI expects. */
function toProfile(local: {
  id: string;
  church_id: string;
  email: string;
  name: string | null;
  onboarding_completed: boolean;
}): Profile {
  const now = new Date(0).toISOString();
  return {
    id: local.id,
    church_id: local.church_id,
    email: local.email,
    name: local.name,
    role: LOCAL_ROLE,
    // Every feature is already unlocked on a local install -- there is nothing
    // to sell and nobody to bill -- so the tier is a formality kept only
    // because the shared Profile type carries it.
    subscription: "free",
    subscription_granted_at: null,
    onboarding_completed: local.onboarding_completed,
    created_at: now,
    updated_at: now,
  };
}

export const useAuthStore = create<AuthState>((set, get) => ({
  session: null,
  profile: null,
  status: "loading",
  setupCompleted: true,

  initialize: async () => {
    const local = await invoke("profile.get");
    set({
      profile: toProfile(local),
      session: { user: { id: local.id, email: local.email } },
      status: "authenticated",
      setupCompleted: local.setup_completed,
    });
  },

  completeSetup: async ({ name }) => {
    const trimmed = name.trim();
    await invoke("profile.update", {
      patch: { setup_completed: true, ...(trimmed ? { name: trimmed } : {}) },
    });
    const profile = get().profile;
    set({
      setupCompleted: true,
      profile: profile && trimmed ? { ...profile, name: trimmed } : profile,
    });
  },

  refreshProfile: async () => {
    const local = await invoke("profile.get");
    set({ profile: toProfile(local), setupCompleted: local.setup_completed });
  },

  updateName: async (name) => {
    try {
      await invoke("profile.update", { patch: { name } });
    } catch (err) {
      return { error: err instanceof Error ? err.message : "Couldn't save your name." };
    }
    const profile = get().profile;
    if (profile) set({ profile: { ...profile, name } });
    return { error: null };
  },

  signOut: async () => {},
}));
