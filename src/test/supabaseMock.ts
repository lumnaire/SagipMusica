import { vi } from "vitest";

type QueryResponse = { data?: unknown; error?: unknown; count?: number | null };

/**
 * Builds a chainable stand-in for a Supabase query builder
 * (`.select().eq().order()...`) that resolves to `response` when awaited,
 * regardless of which/how many chain methods were called first.
 */
export function createQueryBuilderMock(response: QueryResponse = { data: [], error: null }) {
  const builder: Record<string, unknown> = {};
  const chainMethods = [
    "select",
    "insert",
    "update",
    "delete",
    "upsert",
    "eq",
    "in",
    "not",
    "order",
    "limit",
    "single",
  ];
  for (const method of chainMethods) {
    builder[method] = vi.fn(() => builder);
  }
  (builder as unknown as PromiseLike<QueryResponse>).then = (resolve, reject) =>
    Promise.resolve(response).then(resolve, reject);
  return builder;
}

/**
 * A minimal fake Supabase client. Pass `tableResponses` to control what
 * `.from("table_name")` resolves to; anything not listed resolves to an
 * empty, error-free result so unrelated queries don't blow up a test.
 */
export function createSupabaseMock(tableResponses: Record<string, QueryResponse> = {}) {
  return {
    from: vi.fn((table: string) => createQueryBuilderMock(tableResponses[table])),
    // RPCs (superadmin_*, delete_own_account) and Realtime presence channels.
    rpc: vi.fn().mockResolvedValue({ data: null, error: null }),
    channel: vi.fn(() => {
      const ch: Record<string, unknown> = {
        on: vi.fn(() => ch),
        subscribe: vi.fn(() => ch),
        track: vi.fn().mockResolvedValue("ok"),
        presenceState: vi.fn(() => ({})),
      };
      return ch;
    }),
    removeChannel: vi.fn().mockResolvedValue("ok"),
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
      onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
      signInWithPassword: vi.fn().mockResolvedValue({ error: null }),
      signOut: vi.fn().mockResolvedValue({ error: null }),
    },
  };
}
