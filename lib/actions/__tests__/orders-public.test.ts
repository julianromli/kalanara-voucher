import { beforeEach, describe, expect, it, vi } from "vitest";

const ordersMaybeSingle = vi.fn();
const ordersOrder = vi.fn();
const ordersQuery = { maybeSingle: ordersMaybeSingle, order: ordersOrder };
ordersOrder.mockReturnValue(ordersQuery);
const ordersEqToken = vi.fn(() => ordersQuery);
const ordersEqOrderId = vi.fn(() => ({ eq: ordersEqToken }));
const ordersSelect = vi.fn(() => ({ eq: ordersEqOrderId }));

const orderItemsOrder = vi.fn();
const orderItemsEq = vi.fn();
const orderItemsQuery = {
  eq: orderItemsEq,
  order: orderItemsOrder,
};
const orderItemsSelect = vi.fn(() => orderItemsQuery);

const from = vi.fn((table: string) => {
  if (table === "orders") {
    return { select: ordersSelect };
  }

  if (table === "order_items") {
    return { select: orderItemsSelect };
  }

  throw new Error(`Unexpected table ${table}`);
});

vi.mock("next/cache", () => ({
  revalidateTag: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

vi.mock("@/lib/supabase/admin", () => ({
  getAdminClient: vi.fn(() => ({
    from,
  })),
}));

import {
  getPublicOrderDetailsWithItems,
} from "@/lib/payment/order-capability-reads";
import { getOrderItemsByOrderId } from "@/lib/actions/orders";

describe("getPublicOrderDetailsWithItems", () => {
  beforeEach(() => {
    from.mockClear();
    ordersSelect.mockClear();
    ordersEqOrderId.mockClear();
    ordersEqToken.mockClear();
    ordersMaybeSingle.mockReset();
    ordersOrder.mockClear();
    ordersOrder.mockReturnValue(ordersQuery);
    ordersMaybeSingle.mockResolvedValue({ data: null, error: null });

    orderItemsSelect.mockClear();
    orderItemsEq.mockReset();
    orderItemsOrder.mockReset();
    orderItemsEq.mockReturnValue(orderItemsQuery);
    orderItemsOrder
      .mockReturnValueOnce(orderItemsQuery)
      .mockResolvedValueOnce({ data: [], error: null });
  });

  it("disambiguates nested order item vouchers for public order item details", async () => {
    await getPublicOrderDetailsWithItems("KSP-123", "public-token");

    expect(ordersSelect).toHaveBeenCalledWith(
      "*, services(*), vouchers:vouchers!orders_voucher_id_fkey(*, services(*)), order_items(*, services(*), vouchers:vouchers!order_items_voucher_id_fkey(*))"
    );
    expect(ordersOrder.mock.calls).toEqual([
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

  it("returns null when the capability does not match an order", async () => {
    await expect(
      getPublicOrderDetailsWithItems("KSP-missing", "invalid-token")
    ).resolves.toBeNull();
    expect(ordersMaybeSingle).toHaveBeenCalledOnce();
  });

  it("throws a sanitized error with the database error as its cause", async () => {
    const databaseError = {
      message: "relation internals and capability token leaked",
      code: "XX000",
    };
    ordersMaybeSingle.mockResolvedValueOnce({
      data: null,
      error: databaseError,
    });

    const promise = getPublicOrderDetailsWithItems("KSP-123", "public-token");
    await expect(promise).rejects.toThrow(
      "Failed to fetch capability-bound order details"
    );
    await expect(promise).rejects.not.toThrow(databaseError.message);
    await expect(promise).rejects.toMatchObject({ cause: databaseError });
  });

  it("disambiguates order item voucher lookup for fulfillment reads", async () => {
    await getOrderItemsByOrderId("order-1");

    expect(orderItemsSelect).toHaveBeenCalledWith(
      "*, services(*), vouchers:vouchers!order_items_voucher_id_fkey(*)"
    );
  });
});
