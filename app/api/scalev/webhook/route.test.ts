import { createHmac } from "node:crypto";
import { beforeEach, describe, expect, test, vi } from "vitest";

const {
  getOrderItemsByOrderIdMock,
  getOrderByScalevOrderIdMock,
  getOrderByScalevOrderPkMock,
  getOrderByScalevPgReferenceIdMock,
  updateOrderGatewayDataMock,
  updateOrderPaymentStatusMock,
  markDiscountRedemptionSucceededMock,
  markDiscountRedemptionVoidMock,
  createScalevWebhookEventMock,
  updateScalevWebhookEventMock,
  createVoucherOnPaymentSuccessMock,
} = vi.hoisted(() => ({
  getOrderItemsByOrderIdMock: vi.fn(),
  getOrderByScalevOrderIdMock: vi.fn(),
  getOrderByScalevOrderPkMock: vi.fn(),
  getOrderByScalevPgReferenceIdMock: vi.fn(),
  updateOrderGatewayDataMock: vi.fn(),
  updateOrderPaymentStatusMock: vi.fn(),
  markDiscountRedemptionSucceededMock: vi.fn(),
  markDiscountRedemptionVoidMock: vi.fn(),
  createScalevWebhookEventMock: vi.fn(),
  updateScalevWebhookEventMock: vi.fn(),
  createVoucherOnPaymentSuccessMock: vi.fn(),
}));

vi.mock("@/lib/actions/orders", () => ({
  getOrderItemsByOrderId: getOrderItemsByOrderIdMock,
  getOrderByScalevOrderId: getOrderByScalevOrderIdMock,
  getOrderByScalevOrderPk: getOrderByScalevOrderPkMock,
  getOrderByScalevPgReferenceId: getOrderByScalevPgReferenceIdMock,
  updateOrderGatewayData: updateOrderGatewayDataMock,
  updateOrderPaymentStatus: updateOrderPaymentStatusMock,
}));

vi.mock("@/lib/actions/scalevWebhookEvents", () => ({
  createScalevWebhookEvent: createScalevWebhookEventMock,
  updateScalevWebhookEvent: updateScalevWebhookEventMock,
}));

vi.mock("@/lib/discounts/service", () => ({
  markDiscountRedemptionSucceeded: markDiscountRedemptionSucceededMock,
  markDiscountRedemptionVoid: markDiscountRedemptionVoidMock,
}));

vi.mock("@/lib/payment/voucher-service", () => ({
  createVoucherOnPaymentSuccess: createVoucherOnPaymentSuccessMock,
}));

vi.mock("@/lib/scalev/config", () => ({
  getScalevConfig: () => ({
    webhookSigningSecret: "super-secret",
  }),
}));

function signPayload(body: string) {
  return createHmac("sha256", "super-secret").update(body, "utf8").digest("base64");
}

describe("POST /api/scalev/webhook", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    createScalevWebhookEventMock.mockResolvedValue({ id: "event-1" });
    updateScalevWebhookEventMock.mockResolvedValue(true);
    updateOrderGatewayDataMock.mockResolvedValue(true);
    updateOrderPaymentStatusMock.mockResolvedValue(true);
    markDiscountRedemptionSucceededMock.mockResolvedValue(true);
    markDiscountRedemptionVoidMock.mockResolvedValue(true);
    createVoucherOnPaymentSuccessMock.mockResolvedValue({ success: true, voucherCount: 1 });
    getOrderByScalevOrderPkMock.mockResolvedValue({
      id: "order-1",
      payment_order_id: "KSP-123",
      payment_transaction_id: null,
      payment_provider: "scalev",
      payment_status: "PENDING",
      scalev_payment_method: "qris",
      scalev_sub_payment_method: null,
      scalev_store_unique_id: "store-1",
      scalev_raw_status: "pending",
      scalev_raw_payment_status: "pending",
    });
    getOrderByScalevPgReferenceIdMock.mockResolvedValue(null);
    getOrderByScalevOrderIdMock.mockResolvedValue(null);
    getOrderItemsByOrderIdMock.mockResolvedValue([]);
  });

  test("rejects invalid webhook signatures", async () => {
    const { POST } = await import("@/app/api/scalev/webhook/route");

    const response = await POST(
      new Request("http://localhost/api/scalev/webhook", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Scalev-Hmac-Sha256": "invalid-signature",
        },
        body: JSON.stringify({ event: "order.payment_status_changed", data: {} }),
      }) as never
    );

    expect(response.status).toBe(401);
    expect(createVoucherOnPaymentSuccessMock).not.toHaveBeenCalled();
    expect(createScalevWebhookEventMock).toHaveBeenCalled();
  });

  test("fulfills vouchers for a newly completed payment", async () => {
    const { POST } = await import("@/app/api/scalev/webhook/route");
    const payload = JSON.stringify({
      event: "order.payment_status_changed",
      data: {
        id: 99,
        order_id: "scalev-1",
        pg_reference_id: "pg-1",
        payment_status: "paid",
        payment_method: "qris",
      },
    });

    const response = await POST(
      new Request("http://localhost/api/scalev/webhook", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Scalev-Hmac-Sha256": signPayload(payload),
        },
        body: payload,
      }) as never
    );

    expect(response.status).toBe(200);
    expect(updateOrderPaymentStatusMock).toHaveBeenCalledWith(
      "order-1",
      "COMPLETED",
      expect.any(Object)
    );
    expect(createVoucherOnPaymentSuccessMock).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "order-1",
        payment_status: "COMPLETED",
      })
    );
    expect(markDiscountRedemptionSucceededMock).toHaveBeenCalledWith("order-1");
  });

  test("skips duplicate fulfillment when every order item already has a voucher", async () => {
    const { POST } = await import("@/app/api/scalev/webhook/route");
    const payload = JSON.stringify({
      event: "order.payment_status_changed",
      data: {
        id: 99,
        pg_reference_id: "pg-1",
        payment_status: "paid",
        payment_method: "qris",
      },
    });

    getOrderItemsByOrderIdMock.mockResolvedValue([
      {
        id: "item-1",
        voucher_id: "voucher-1",
        vouchers: { id: "voucher-1" },
      },
    ]);

    const response = await POST(
      new Request("http://localhost/api/scalev/webhook", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Scalev-Hmac-Sha256": signPayload(payload),
        },
        body: payload,
      }) as never
    );

    expect(response.status).toBe(200);
    expect(createVoucherOnPaymentSuccessMock).not.toHaveBeenCalled();
    expect(updateScalevWebhookEventMock).toHaveBeenCalledWith(
      "event-1",
      expect.objectContaining({
        processing_message: "Payment completed; vouchers already fulfilled",
      })
    );
  });

  test("voids pending discount redemption when payment fails", async () => {
    const { POST } = await import("@/app/api/scalev/webhook/route");
    const payload = JSON.stringify({
      event: "order.payment_status_changed",
      data: {
        id: 99,
        pg_reference_id: "pg-1",
        payment_status: "expired",
        payment_method: "qris",
      },
    });

    const response = await POST(
      new Request("http://localhost/api/scalev/webhook", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Scalev-Hmac-Sha256": signPayload(payload),
        },
        body: payload,
      }) as never
    );

    expect(response.status).toBe(200);
    expect(updateOrderPaymentStatusMock).toHaveBeenCalledWith(
      "order-1",
      "FAILED",
      expect.any(Object)
    );
    expect(markDiscountRedemptionVoidMock).toHaveBeenCalledWith("order-1");
    expect(createVoucherOnPaymentSuccessMock).not.toHaveBeenCalled();
  });

  test("acknowledges webhook when discount redemption sync fails on completion", async () => {
    const { POST } = await import("@/app/api/scalev/webhook/route");
    const payload = JSON.stringify({
      event: "order.payment_status_changed",
      data: {
        id: 99,
        order_id: "scalev-1",
        pg_reference_id: "pg-1",
        payment_status: "paid",
        payment_method: "qris",
      },
    });

    markDiscountRedemptionSucceededMock.mockResolvedValue(false);

    const response = await POST(
      new Request("http://localhost/api/scalev/webhook", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Scalev-Hmac-Sha256": signPayload(payload),
        },
        body: payload,
      }) as never
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      status: "ok",
      message: "Failed to synchronize discount redemption",
    });
    expect(createVoucherOnPaymentSuccessMock).not.toHaveBeenCalled();
    expect(updateScalevWebhookEventMock).toHaveBeenCalledWith(
      "event-1",
      expect.objectContaining({
        processing_status: "failed",
        processing_message: "Failed to synchronize discount redemption",
      })
    );
  });

  test("acknowledges webhook when voiding discount redemption fails", async () => {
    const { POST } = await import("@/app/api/scalev/webhook/route");
    const payload = JSON.stringify({
      event: "order.payment_status_changed",
      data: {
        id: 99,
        pg_reference_id: "pg-1",
        payment_status: "expired",
        payment_method: "qris",
      },
    });

    markDiscountRedemptionVoidMock.mockResolvedValue(false);

    const response = await POST(
      new Request("http://localhost/api/scalev/webhook", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Scalev-Hmac-Sha256": signPayload(payload),
        },
        body: payload,
      }) as never
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      status: "ok",
      message: "Failed to void discount redemption",
    });
    expect(createVoucherOnPaymentSuccessMock).not.toHaveBeenCalled();
    expect(updateScalevWebhookEventMock).toHaveBeenCalledWith(
      "event-1",
      expect.objectContaining({
        processing_status: "failed",
        processing_message: "Failed to void discount redemption",
      })
    );
  });
});
