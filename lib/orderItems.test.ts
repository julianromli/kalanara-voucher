import { describe, expect, test, vi } from "vitest";
import { sortOrderItems } from "@/lib/orderItems";

describe("sortOrderItems", () => {
  test("uses locale-independent code-unit ordering for string tie-breakers", () => {
    const localeCompare = vi
      .spyOn(String.prototype, "localeCompare")
      .mockImplementation(() => {
        throw new Error("localeCompare must not determine order item sorting");
      });

    try {
      expect(
        sortOrderItems([
          { id: "item-b", sort_order: 1, created_at: "2026-01-02T00:00:00Z" },
          { id: "item-c", sort_order: 2, created_at: "2026-01-01T00:00:00Z" },
          { id: "item-a", sort_order: 1, created_at: "2026-01-02T00:00:00Z" },
        ]).map((item) => item.id)
      ).toEqual(["item-a", "item-b", "item-c"]);
    } finally {
      localeCompare.mockRestore();
    }
  });
});
