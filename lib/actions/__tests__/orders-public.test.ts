import { beforeEach, describe, expect, it, vi } from "vitest";

const ordersSingle = vi.fn();
const ordersEqToken = vi.fn(() => ({ single: ordersSingle }));
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
  getOrderItemsByOrderId,
  getPublicOrderDetails,
  getPublicOrderDetailsWithItems,
} from "@/lib/actions/orders";

describe("getPublicOrderDetails", () => {
  beforeEach(() => {
    from.mockClear();
    ordersSelect.mockClear();
    ordersEqOrderId.mockClear();
    ordersEqToken.mockClear();
    ordersSingle.mockReset();
    ordersSingle.mockResolvedValue({ data: null, error: null });

    orderItemsSelect.mockClear();
    orderItemsEq.mockReset();
    orderItemsOrder.mockReset();
    orderItemsEq.mockReturnValue(orderItemsQuery);
    orderItemsOrder
      .mockReturnValueOnce(orderItemsQuery)
      .mockResolvedValueOnce({ data: [], error: null });
  });

  it("disambiguates the order voucher relationship explicitly", async () => {
    await getPublicOrderDetails("KSP-123", "public-token");

    expect(ordersSelect).toHaveBeenCalledWith(
      "*, vouchers:vouchers!orders_voucher_id_fkey(*, services(*))"
    );
  });

  it("disambiguates nested order item vouchers for public order item details", async () => {
    await getPublicOrderDetailsWithItems("KSP-123", "public-token");

    expect(ordersSelect).toHaveBeenCalledWith(
      "*, services(*), order_items(*, services(*), vouchers:vouchers!order_items_voucher_id_fkey(*))"
    );
  });

  it("disambiguates order item voucher lookup for fulfillment reads", async () => {
    await getOrderItemsByOrderId("order-1");

    expect(orderItemsSelect).toHaveBeenCalledWith(
      "*, services(*), vouchers:vouchers!order_items_voucher_id_fkey(*)"
    );
  });
});
