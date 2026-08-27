import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * A stand-in for PostgREST that enforces a row cap the way the real one does:
 * silently. The request succeeds, `error` is null, and you get a prefix.
 *
 * This is the shape of bug that put a complete Bible in the database and a
 * New Testament with no chapters in the picker, so it is worth simulating
 * exactly rather than trusting a comment not to be forgotten.
 */
function createCappedTable(rowCount: number, cap: number) {
  const calls: { from: number; to: number }[] = [];

  const rows = Array.from({ length: rowCount }, (_, i) => ({
    book_id: Math.floor(i / 20) + 1,
    chapter: (i % 20) + 1,
    verse_count: 10,
  }));

  const builder: Record<string, unknown> = {};
  let range: { from: number; to: number } = { from: 0, to: cap - 1 };

  for (const method of ["select", "eq", "order"]) {
    builder[method] = vi.fn(() => builder);
  }
  builder.range = vi.fn((from: number, to: number) => {
    range = { from, to };
    return builder;
  });

  (builder as unknown as PromiseLike<unknown>).then = (resolve, reject) => {
    calls.push({ ...range });
    // The server never returns more than `cap`, however wide a range is asked
    // for — this is the part that makes over-fetching fail quietly.
    const width = Math.min(range.to - range.from + 1, cap);
    const page = rows.slice(range.from, range.from + width);
    return Promise.resolve({ data: page, error: null, count: rows.length }).then(
      resolve,
      reject,
    );
  };

  return { builder, calls, rows };
}

const table = vi.hoisted(() => ({ current: null as ReturnType<typeof createCappedTable> | null }));

vi.mock("@/lib/supabase/client", () => ({
  supabase: { from: () => table.current!.builder },
}));

const { fetchChapterIndex } = await import("./api");

describe("fetchChapterIndex", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("reads all 1,189 KJV chapters past a 1,000-row cap", async () => {
    // The exact regression: 1,189 chapters against Supabase's default cap.
    // Unpaged, this returned 1,000 rows and lost John 4 onwards.
    table.current = createCappedTable(1189, 1000);

    const rows = await fetchChapterIndex("kjv");

    expect(rows).toHaveLength(1189);
    expect(rows).toEqual(table.current.rows);
    expect(table.current.calls.length).toBeGreaterThan(1);
  });

  it("pages correctly when the server's cap is smaller than our page size", async () => {
    // A project configured with a lower max-rows. Taking the page size from
    // the response rather than from our constant is what makes this work —
    // assuming 1,000 would see a 250-row first page, call it short, and stop.
    table.current = createCappedTable(1189, 250);

    const rows = await fetchChapterIndex("kjv");

    expect(rows).toHaveLength(1189);
    expect(rows).toEqual(table.current.rows);
  });

  it("does not ask for more once it has everything", async () => {
    // Exactly one page, exactly enough: no wasted round trip afterwards.
    table.current = createCappedTable(600, 1000);

    const rows = await fetchChapterIndex("kjv");

    expect(rows).toHaveLength(600);
    expect(table.current.calls).toHaveLength(1);
  });

  it("terminates when the row count is an exact multiple of the cap", async () => {
    // The case that loops forever if you only ever break on a short page.
    table.current = createCappedTable(2000, 1000);

    const rows = await fetchChapterIndex("kjv");

    expect(rows).toHaveLength(2000);
  });

  it("returns nothing for a translation with no verses", async () => {
    table.current = createCappedTable(0, 1000);

    expect(await fetchChapterIndex("nope")).toEqual([]);
  });
});
