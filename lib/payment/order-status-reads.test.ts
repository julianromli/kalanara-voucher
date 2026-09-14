import { beforeEach, describe, expect, test, vi } from "vitest";

const { order, single, from } = vi.hoisted(() => {
  const single = vi.fn();
  const order = vi.fn();
  const eq = vi.fn();
  const query = { eq, order, single };
  eq.mockReturnValue(query);
  order.mockReturnValue(query);
  const select = vi.fn(() => query);
  const from = vi.fn(() => ({ select }));
  return { order, single, from };
});

vi.mock("@/lib/supabase/admin", () => ({
  getAdminClient: () => ({ from }),
}));

describe("order status item reads", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    single.mockResolvedValue({ data: null, error: null });
  });

  test("orders nested items by sort order then creation time", async () => {
    const { getOrderStatusDetailsWithItemsById } = await import(
      "@/lib/payment/order-status-reads"
    );

    await getOrderStatusDetailsWithItemsById("order-1");

    expect(order.mock.calls).toEqual([
      [
        "sort_order",
        { ascending: true, referencedTable: "order_items" },
      ],
      [
        "created_at",
        { ascending: true, referencedTable: "order_items" },
      ],
    ]);
  });
});
