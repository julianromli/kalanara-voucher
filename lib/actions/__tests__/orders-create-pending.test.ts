import { beforeEach, describe, expect, test, vi } from "vitest";
import { DeliveryMethod, SendTo } from "@/lib/types";

const {
  orderLookupSingleMock,
  serviceLookupInMock,
  paymentIdSingleMock,
  orderInsertMock,
  orderInsertSingleMock,
  orderItemsInsertMock,
} = vi.hoisted(() => ({
  orderLookupSingleMock: vi.fn(),
  serviceLookupInMock: vi.fn(),
  paymentIdSingleMock: vi.fn(),
  orderInsertMock: vi.fn(),
  orderInsertSingleMock: vi.fn(),
  orderItemsInsertMock: vi.fn(),
}));

const fromMock = vi.fn((table: string) => {
  if (table === "orders") {
    return {
      select: vi.fn((columns: string) => {
        if (columns === "id") {
          return {
            eq: vi.fn(() => ({ single: paymentIdSingleMock })),
          };
        }

        return {
          eq: vi.fn(() => ({ single: orderLookupSingleMock })),
        };
      }),
      insert: orderInsertMock,
    };
  }

  if (table === "services") {
    return {
      select: vi.fn(() => ({ in: serviceLookupInMock })),
    };
  }

  return {
    insert: orderItemsInsertMock,
  };
});

vi.mock("next/cache", () => ({
  revalidateTag: vi.fn(),
}));

vi.mock("@/lib/auth/admin-rbac-server", () => ({
  logAdminAudit: vi.fn(),
  requireAdminPermission: vi.fn(),
}));

vi.mock("@/lib/supabase/admin", () => ({
  getAdminClient: () => ({
    from: fromMock,
  }),
}));

vi.mock("@/lib/scalev/mappers", () => ({
  mapScalevPaymentMethodToLocal: vi.fn(() => "BANK_TRANSFER"),
}));

describe("createPendingOrder", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    paymentIdSingleMock.mockResolvedValue({ data: null, error: null });
    orderInsertMock.mockReturnValue({
      select: vi.fn(() => ({ single: orderInsertSingleMock })),
    });
    orderInsertSingleMock.mockResolvedValue({
      data: { id: "order-1" },
      error: null,
    });
    orderLookupSingleMock.mockResolvedValue({
      data: {
        id: "order-1",
        subtotal_amount: 700000,
        discount_amount: 70000,
        total_amount: 630000,
        payment_status: "PENDING",
        payment_provider: "scalev",
      },
      error: null,
    });
    serviceLookupInMock.mockResolvedValue({
      data: [
        { id: "service-1", price: 450000, is_active: true },
        { id: "service-2", price: 250000, is_active: true },
      ],
      error: null,
    });
    orderItemsInsertMock.mockReturnValue({
      select: vi.fn().mockResolvedValue({
        data: [{ id: "item-1" }, { id: "item-2" }],
        error: null,
      }),
    });
  });

  test("stores recipient_phone as null when it is not relevant", async () => {
    const { createPendingOrderForCheckout } = await import(
      "@/lib/payment/order-writes"
    );

    await createPendingOrderForCheckout({
      service_id: "service-1",
      customer_email: "buyer@example.com",
      customer_name: "Faiz",
      customer_phone: "6281234567890",
      recipient_name: "Penerima",
      recipient_email: undefined,
      recipient_phone: null,
      sender_message: undefined,
      delivery_method: DeliveryMethod.WHATSAPP,
      send_to: SendTo.PURCHASER,
      subtotal_amount: 450000,
      discount_code_id: null,
      discount_code: null,
      discount_type_snapshot: null,
      discount_value_snapshot: null,
      discount_amount: 0,
      total_amount: 450000,
      payment_method: "qris",
      sub_payment_method: undefined,
    });

    expect(orderInsertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        recipient_phone: null,
      })
    );
  });

  test("does not expose unrestricted payment writes as Server Actions", async () => {
    const orderActions = await import("@/lib/actions/orders");

    expect(orderActions).not.toHaveProperty("createOrder");
    expect(orderActions).not.toHaveProperty("createPendingOrder");
    expect(orderActions).not.toHaveProperty("createPendingOrderItems");
    expect(orderActions).not.toHaveProperty("updateOrderPaymentStatus");
    expect(orderActions).not.toHaveProperty("updateOrderGatewayData");
    expect(orderActions).not.toHaveProperty("markOrderFailedFromGateway");
    expect(orderActions).not.toHaveProperty("updateOrderVoucherId");
    expect(orderActions).not.toHaveProperty("updateOrderItemVoucherId");
  });

  test("derives order-item prices and linkage from the stored order and services", async () => {
    const { createPendingOrderItemsForOrder } = await import(
      "@/lib/payment/order-writes"
    );

    await createPendingOrderItemsForOrder("order-1", [
      {
        service_id: "service-1",
        recipient_name: "A",
        recipient_email: null,
        recipient_phone: "628111",
        sender_message: null,
        delivery_method: DeliveryMethod.WHATSAPP,
        send_to: SendTo.RECIPIENT,
        sort_order: 0,
        order_id: "foreign-order",
        original_unit_price: 1,
        discount_amount: 0,
        final_unit_price: 1,
        unit_price: 1,
        payment_status: "COMPLETED",
        voucher_id: "foreign-voucher",
      } as never,
      {
        service_id: "service-2",
        recipient_name: "B",
        recipient_email: "b@example.com",
        recipient_phone: null,
        sender_message: null,
        delivery_method: DeliveryMethod.EMAIL,
        send_to: SendTo.RECIPIENT,
        sort_order: 1,
      },
    ]);

    expect(orderItemsInsertMock).toHaveBeenCalledWith([
      expect.objectContaining({
        order_id: "order-1",
        service_id: "service-1",
        original_unit_price: 450000,
        discount_amount: 45000,
        final_unit_price: 405000,
        unit_price: 405000,
      }),
      expect.objectContaining({
        order_id: "order-1",
        service_id: "service-2",
        original_unit_price: 250000,
        discount_amount: 25000,
        final_unit_price: 225000,
        unit_price: 225000,
      }),
    ]);
    expect(orderItemsInsertMock.mock.calls[0][0][0]).not.toHaveProperty(
      "voucher_id"
    );
  });
});
