import { describe, expect, test } from "vitest";
import { fetchAllRows, SUPABASE_PAGE_SIZE } from "@/lib/supabase/fetch-all-rows";

describe("fetchAllRows", () => {
  test("fetches every page past the Supabase row cap", async () => {
    const all = Array.from({ length: SUPABASE_PAGE_SIZE + 3 }, (_, index) => ({ id: String(index) }));
    const ranges: Array<[number, number]> = [];
    const result = await fetchAllRows(() => ({
      order: () => ({
        range: (from: number, to: number) => {
          ranges.push([from, to]);
          return Promise.resolve({ data: all.slice(from, to + 1), error: null });
        },
      }),
    }));
    expect(result.error).toBeNull();
    expect(result.data).toHaveLength(SUPABASE_PAGE_SIZE + 3);
    expect(result.data[0]?.id).toBe("0");
    expect(result.data.at(-1)?.id).toBe(String(SUPABASE_PAGE_SIZE + 2));
    expect(ranges).toEqual([
      [0, SUPABASE_PAGE_SIZE - 1],
      [SUPABASE_PAGE_SIZE, SUPABASE_PAGE_SIZE * 2 - 1],
    ]);
  });

  test("stops and returns the error when a later page fails", async () => {
    const result = await fetchAllRows<{ id: string }>(() => ({
      order: () => ({
        range: (from: number) => {
          if (from === 0) {
            return Promise.resolve({
              data: Array.from({ length: SUPABASE_PAGE_SIZE }, (_, index) => ({ id: String(index) })),
              error: null,
            });
          }
          return Promise.resolve({ data: null, error: { message: "timeout" } });
        },
      }),
    }));
    expect(result).toEqual({ data: [], error: { message: "timeout" } });
  });
});
