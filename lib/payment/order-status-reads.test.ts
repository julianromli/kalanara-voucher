import { beforeEach, describe, expect, test, vi } from "vitest";

const { select, eq, order, maybeSingle, from } = vi.hoisted(() => {
  const maybeSingle = vi.fn();
  const order = vi.fn();
  const eq = vi.fn();
  const query = { eq, order, maybeSingle };
  eq.mockReturnValue(query);
  order.mockReturnValue(query);
  const select = vi.fn(() => query);
  const from = vi.fn(() => ({ select }));
  return { select, eq, order, maybeSingle, from };
});

vi.mock("@/lib/supabase/admin", () => ({
  getAdminClient: () => ({ from }),
}));

describe("order status reads", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    maybeSingle.mockResolvedValue({ data: null, error: null });
  });

  test("queries the exact order and returns nested items in deterministic order", async () => {
    maybeSingle.mockResolvedValue({
      data: {
        id: "order-1",
        order_items: [
          {
            id: "item-3",
            sort_order: 2,
            created_at: "2026-01-01T00:00:00.000Z",
          },
          {
            id: "item-2",
            sort_order: 1,
            created_at: "2026-01-02T00:00:00.000Z",
          },
          {
            id: "item-1",
            sort_order: 1,
            created_at: "2026-01-01T00:00:00.000Z",
          },
        ],
      },
      error: null,
    });
    const { getOrderStatusDetailsWithItemsById } = await import(
      "@/lib/payment/order-status-reads"
    );

    const result = await getOrderStatusDetailsWithItemsById("order-1");

    expect(select).toHaveBeenCalledWith(
      "*, services(*), vouchers:vouchers!orders_voucher_id_fkey(*, services(*)), order_items(*, services(*), vouchers:vouchers!order_items_voucher_id_fkey(*))"
    );
    expect(eq).toHaveBeenCalledWith("id", "order-1");
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
    expect(result?.order_items.map((item) => item.id)).toEqual([
      "item-1",
      "item-2",
      "item-3",
    ]);
  });

  test.each([
    "getOrderForStatusById",
    "getOrderStatusDetailsById",
    "getOrderStatusDetailsWithItemsById",
  ] as const)("%s returns null when the order is absent", async (helperName) => {
    const helpers = await import("@/lib/payment/order-status-reads");

    await expect(helpers[helperName]("missing-order")).resolves.toBeNull();
    expect(maybeSingle).toHaveBeenCalledOnce();
  });

  test.each([
    "getOrderForStatusById",
    "getOrderStatusDetailsById",
    "getOrderStatusDetailsWithItemsById",
  ] as const)("%s throws a safe error on query failure", async (helperName) => {
    const databaseError = {
      code: "08006",
      message: "connection details that must not be exposed",
    };
    maybeSingle.mockResolvedValue({ data: null, error: databaseError });
    const helpers = await import("@/lib/payment/order-status-reads");

    const result = helpers[helperName]("order-1");

    await expect(result).rejects.toThrow("Failed to fetch order status.");
    await expect(result).rejects.not.toThrow(databaseError.message);
    await expect(result).rejects.toMatchObject({ cause: databaseError });
  });
});
