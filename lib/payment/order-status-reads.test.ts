import { beforeEach, describe, expect, test, vi } from "vitest";

const { order, maybeSingle, from } = vi.hoisted(() => {
  const maybeSingle = vi.fn();
  const order = vi.fn();
  const eq = vi.fn();
  const query = { eq, order, maybeSingle };
  eq.mockReturnValue(query);
  order.mockReturnValue(query);
  const select = vi.fn(() => query);
  const from = vi.fn(() => ({ select }));
  return { order, maybeSingle, from };
});

vi.mock("@/lib/supabase/admin", () => ({
  getAdminClient: () => ({ from }),
}));

describe("order status reads", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    maybeSingle.mockResolvedValue({ data: null, error: null });
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
