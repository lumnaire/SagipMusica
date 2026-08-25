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

/**
 * Why this is three outcomes and not `Profile | null`.
 *
 * "The row is gone" and "we could not reach the database" look identical
 * through a nullable return, and the caller has to do opposite things with
 * them: the first means the account no longer exists and the session should
 * end, the second means try again later. Collapsing them is what let a dropped
 * request sign a working account out.
 */
type ProfileResult =
  | { kind: "ok"; profile: Profile }
  | { kind: "unreadable"; message: string };

const RETRY_DELAYS_MS = [250, 600];

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Reads the signed-in user's profile, retrying before it gives up.
 *
 * Note what is NOT here: a "the account no longer exists" outcome. It looks
 * like it should be knowable -- the row is either there or it is not -- but
 * from the client it is not, because of how the read is gated:
 *
 *     create policy "profiles_select_own_church" on profiles
 *       for select to authenticated using (... or id = auth.uid());
 *
 * The policy is scoped `to authenticated`. A request that reaches PostgREST
 * without a usable token matches no policy at all and comes back as an empty
 * set with no error -- byte for byte what a deleted account returns. Anything
 * built on top of that distinction is guessing, and the guess used to be
 * "deleted", answered with signOut(). That is what threw away a working
 * session mid sign-in and sent the next page load to the login screen.
 *
 * So an empty result is retried like any other failure, and if it never
 * resolves the session is left alone for the next load to recover.
 *
 * The retries matter because this one query gates the whole app: until it
 * answers, the user has no role and every route guard treats them as a
 * stranger.
 */
async function fetchProfile(userId: string): Promise<ProfileResult> {
  let message = "Could not reach the server.";

  for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .maybeSingle();

    if (!error && data) return { kind: "ok", profile: data as Profile };

    if (error) {
      message = error.message;
      console.error(`Failed to load profile (attempt ${attempt + 1})`, error);
    } else {
      message = "The account could not be read.";
      console.error(
        `Profile read returned no rows (attempt ${attempt + 1}). Either the ` +
          `request was unauthenticated or the profiles row is missing.`,
      );
    }

    if (attempt < RETRY_DELAYS_MS.length) await delay(RETRY_DELAYS_MS[attempt]);
  }

  return { kind: "unreadable", message };
}

/**
 * Minimum password length. Enforced here rather than only via the form's
 * `minLength`, which is trivially bypassed. Supabase enforces its own minimum
 * server-side; keep the two in step (Authentication > Providers > Email).
 */
export const MIN_PASSWORD_LENGTH = 8;

const TOO_SHORT = `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`;

let initialized = false;

/**
 * Bumped by every applySession call. A run whose generation is no longer the
 * current one has been overtaken and must not write its result.
 *
 * Two runs really do overlap: initialize() applies the session it read with
 * getSession(), and subscribing to onAuthStateChange immediately delivers
 * INITIAL_SESSION for that same session. Both then fetch the profile, and
 * whichever finished last used to win -- including a run that had already
 * decided to sign the user out.
 */
let applyGeneration = 0;

const PROFILE_UNAVAILABLE =
  "We couldn't load your account just now. Please try again.";

/**
 * Moves a Supabase session into the store, resolving the profile that goes
 * with it.
 *
 * When the profile cannot be read, this reports the user as signed out **in
 * this tab** and leaves the stored Supabase session untouched. It deliberately
 * does not call signOut().
 *
 * Destroying the session was the old behaviour, on the theory that a session
 * outliving its account leaves the app in a state it cannot represent. The
 * theory was fine; the evidence for it was not (see fetchProfile). And the two
 * mistakes are not equally priced -- a stale session left in storage costs a
 * trip through the login page, while a destroyed one costs the sign-in the
 * user was in the middle of. Google sign-in made that expensive: the callback
 * establishes the session and this runs immediately against it, so losing the
 * race meant landing back on /login and starting over.
 */
async function applySession(
  session: Session | null,
  set: (state: Partial<AuthState>) => void,
  get: () => AuthState,
) {
  const generation = ++applyGeneration;
  const superseded = () => generation !== applyGeneration;

  if (!session) {
    set({ session: null, profile: null, status: "unauthenticated" });
    return;
  }

  // Same account, new tokens. TOKEN_REFRESHED fires roughly hourly and again
  // whenever the tab regains focus; re-reading the profile on each one is a
  // round trip that buys nothing and can fail.
  const held = get().profile;
  if (held && held.id === session.user.id) {
    set({ session, status: "authenticated", error: null });
    return;
  }

  const result = await fetchProfile(session.user.id);
  if (superseded()) return;

  if (result.kind === "unreadable") {
    // The stored session stays: a reload retries the read, and it usually
    // succeeds. Signing out here would make the user repeat the whole OAuth
    // round trip instead.
    set({
      session: null,
      profile: null,
      status: "unauthenticated",
      error: PROFILE_UNAVAILABLE,
    });
    return;
  }

  set({ session, profile: result.profile, status: "authenticated", error: null });
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
    await applySession(session, set, get);

    supabase.auth.onAuthStateChange(async (_event, session) => {
      await applySession(session, set, get);
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
    const result = await fetchProfile(userId);
    // Only ever replace a profile with a better one. Writing null here would
    // leave the store authenticated with no role, and every route guard reads
    // profile.role -- a failed refresh would bounce the user off the page they
    // were already on.
    if (result.kind === "ok") set({ profile: result.profile });
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
