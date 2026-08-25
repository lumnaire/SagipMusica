import { describe, expect, it, vi, beforeEach } from "vitest";
import type { Session } from "@supabase/supabase-js";

/**
 * These cover the failure paths around loading a profile, because getting them
 * wrong is invisible until it strands somebody at the login page: a dropped
 * request used to be indistinguishable from a deleted account, and the store
 * responded to both by destroying the session.
 */

type QueryResult = { data: unknown; error: { message: string } | null };

/** Queued answers for the next profile reads, consumed in order. */
let profileResults: QueryResult[] = [];
let profileReads = 0;

const signOut = vi.fn().mockResolvedValue({ error: null });
const getSession = vi.fn();
let authCallback: ((event: string, session: Session | null) => void) | null = null;

vi.mock("@/lib/supabase/client", () => {
  const builder: Record<string, unknown> = {};
  for (const method of ["select", "eq", "update"]) {
    builder[method] = vi.fn(() => builder);
  }
  builder.maybeSingle = vi.fn(() => {
    profileReads++;
    return Promise.resolve(
      profileResults.shift() ?? { data: null, error: null },
    );
  });

  return {
    supabase: {
      from: vi.fn(() => builder),
      auth: {
        getSession,
        signOut,
        onAuthStateChange: vi.fn((cb) => {
          authCallback = cb;
          return { data: { subscription: { unsubscribe: vi.fn() } } };
        }),
      },
    },
  };
});

function session(userId: string, token = "token-1"): Session {
  return { access_token: token, user: { id: userId } } as unknown as Session;
}

const PROFILE = {
  id: "user-1",
  church_id: null,
  email: "ops@lumnaire.com",
  name: "Ops",
  role: "superadmin",
  onboarding_completed: true,
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
};

/** The store keeps module-level init state, so each test needs a fresh copy. */
async function freshStore() {
  vi.resetModules();
  const mod = await import("./auth-store");
  return mod.useAuthStore;
}

describe("auth store", () => {
  beforeEach(() => {
    profileResults = [];
    profileReads = 0;
    authCallback = null;
    signOut.mockClear();
    getSession.mockReset();
  });

  it("keeps the stored session when the profile can't be read", async () => {
    getSession.mockResolvedValue({ data: { session: session("user-1") } });
    // Every attempt fails, the way a dropped connection would.
    profileResults = [
      { data: null, error: { message: "Failed to fetch" } },
      { data: null, error: { message: "Failed to fetch" } },
      { data: null, error: { message: "Failed to fetch" } },
    ];

    const useAuthStore = await freshStore();
    await useAuthStore.getState().initialize();

    // Signing out here would wipe the session from storage, which is what
    // sent the next page load back to the login screen.
    expect(signOut).not.toHaveBeenCalled();
    expect(useAuthStore.getState().status).toBe("unauthenticated");
    expect(useAuthStore.getState().error).toMatch(/couldn't load your account/i);
  });

  it("retries a failed profile read before giving up", async () => {
    getSession.mockResolvedValue({ data: { session: session("user-1") } });
    profileResults = [
      { data: null, error: { message: "Failed to fetch" } },
      { data: PROFILE, error: null },
    ];

    const useAuthStore = await freshStore();
    await useAuthStore.getState().initialize();

    expect(profileReads).toBe(2);
    expect(useAuthStore.getState().status).toBe("authenticated");
    expect(useAuthStore.getState().profile?.role).toBe("superadmin");
  });

  it("never destroys the session over an empty profile read", async () => {
    getSession.mockResolvedValue({ data: { session: session("user-1") } });
    // No error and no row. This is what a deleted account returns -- and also
    // what a request that reached PostgREST without a usable token returns,
    // because profiles_select_own_church is scoped `to authenticated` and an
    // unauthenticated request matches no policy at all. The two are
    // indistinguishable here, which is exactly why signing out on the guess
    // used to end a working Google sign-in.
    profileResults = [
      { data: null, error: null },
      { data: null, error: null },
      { data: null, error: null },
    ];

    const useAuthStore = await freshStore();
    await useAuthStore.getState().initialize();

    expect(signOut).not.toHaveBeenCalled();
    expect(useAuthStore.getState().status).toBe("unauthenticated");
    expect(useAuthStore.getState().error).toMatch(/couldn't load your account/i);
  });

  it("recovers when a later attempt sees the row", async () => {
    getSession.mockResolvedValue({ data: { session: session("user-1") } });
    // The shape of the OAuth race: the first read lands before the token is
    // usable and comes back empty, the retry sees the row.
    profileResults = [
      { data: null, error: null },
      { data: PROFILE, error: null },
    ];

    const useAuthStore = await freshStore();
    await useAuthStore.getState().initialize();

    expect(signOut).not.toHaveBeenCalled();
    expect(useAuthStore.getState().status).toBe("authenticated");
    expect(useAuthStore.getState().profile?.role).toBe("superadmin");
  });

  it("does not re-read the profile when only the token changed", async () => {
    getSession.mockResolvedValue({ data: { session: session("user-1") } });
    profileResults = [{ data: PROFILE, error: null }];

    const useAuthStore = await freshStore();
    await useAuthStore.getState().initialize();
    expect(profileReads).toBe(1);

    // TOKEN_REFRESHED fires roughly hourly and on tab focus. Re-reading the
    // profile each time is a round trip that can fail for no benefit.
    await authCallback?.("TOKEN_REFRESHED", session("user-1", "token-2"));

    expect(profileReads).toBe(1);
    expect(useAuthStore.getState().status).toBe("authenticated");
    expect(useAuthStore.getState().session?.access_token).toBe("token-2");
  });

  it("refreshProfile leaves the existing profile alone when the read fails", async () => {
    getSession.mockResolvedValue({ data: { session: session("user-1") } });
    profileResults = [{ data: PROFILE, error: null }];

    const useAuthStore = await freshStore();
    await useAuthStore.getState().initialize();

    profileResults = [
      { data: null, error: { message: "Failed to fetch" } },
      { data: null, error: { message: "Failed to fetch" } },
      { data: null, error: { message: "Failed to fetch" } },
    ];
    await useAuthStore.getState().refreshProfile();

    // Blanking it would leave the store authenticated with no role, and every
    // route guard reads profile.role -- the user gets bounced off the page.
    expect(useAuthStore.getState().profile?.role).toBe("superadmin");
  });
});
