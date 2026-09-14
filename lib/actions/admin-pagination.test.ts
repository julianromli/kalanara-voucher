import { describe, expect, test } from "vitest";
import {
  ADMIN_MAX_PAGE,
  ADMIN_PAGE_SIZE,
  buildAdminPage,
  escapePostgrestLike,
  normalizeAdminListParams,
} from "@/lib/actions/admin-pagination";

describe("admin pagination contracts", () => {
  test("normalizes page, trims and bounds query, and validates filters", () => {
    expect(
      normalizeAdminListParams(
        {
          page: "3records",
          query: `  ${"x".repeat(120)}  `,
          filter: " completed ",
        },
        ["ALL", "PENDING", "COMPLETED", "FAILED", "REFUNDED"],
      ),
    ).toEqual({
      page: 3,
      query: "x".repeat(100),
      filter: "COMPLETED",
    });

    expect(
      normalizeAdminListParams(
        { page: "-2", query: "   ", filter: "drop table orders" },
        ["ALL", "PENDING"],
      ),
    ).toEqual({ page: 1, query: "", filter: "ALL" });
  });

  test("uses a fixed 25-row page and clamps an out-of-range requested page", () => {
    expect(ADMIN_PAGE_SIZE).toBe(25);
    expect(buildAdminPage(["only-row"], 99, 1)).toEqual({
      rows: ["only-row"],
      page: 1,
      pageSize: 25,
      totalCount: 1,
      totalPages: 1,
    });
    expect(buildAdminPage([], 2, 0)).toEqual({
      rows: [],
      page: 1,
      pageSize: 25,
      totalCount: 0,
      totalPages: 1,
    });
  });

  test("escapes every PostgREST/LIKE control character before interpolation", () => {
    expect(escapePostgrestLike(String.raw`50%_off,(vip)\guest"quote`)).toBe(
      String.raw`50\%\_off\,\(vip\)\\guest\"quote`,
    );
  });

  test("normalizes repeated parameters and caps pages to a bounded offset", () => {
    expect(
      normalizeAdminListParams(
        {
          page: [String(Number.MAX_SAFE_INTEGER), "2"],
          query: ["  ayu  ", "ignored"],
          filter: ["completed", "PENDING"],
        },
        ["ALL", "PENDING", "COMPLETED"],
      ),
    ).toEqual({
      page: ADMIN_MAX_PAGE,
      query: "ayu",
      filter: "COMPLETED",
    });

    expect((ADMIN_MAX_PAGE - 1) * ADMIN_PAGE_SIZE).toBeLessThanOrEqual(
      250_000,
    );
    expect(
      buildAdminPage([], ADMIN_MAX_PAGE, Number.MAX_SAFE_INTEGER).totalPages,
    ).toBe(ADMIN_MAX_PAGE);
  });
});
