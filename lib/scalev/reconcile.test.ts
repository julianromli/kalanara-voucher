import { beforeEach, describe, expect, test, vi } from "vitest";

const {
  getOrderForStatusByIdMock,
  getOrderStatusDetailsByIdMock,
  getOrderStatusDetailsWithItemsByIdMock,
  updateOrderGatewayDataMock,
  updateOrderPaymentStatusMock,
  markDiscountRedemptionSucceededMock,
  markDiscountRedemptionVoidMock,
  createVoucherOnPaymentSuccessMock,
  checkScalevPaymentStatusMock,
  checkScalevSettlementStatusMock,
  getScalevOrderByPgReferenceMock,
  retrieveScalevOrderMock,
  buildPaymentSnapshotMock,
  buildPublicOrderStatusMock,
  buildPublicOrderStatusWithItemsMock,
} = vi.hoisted(() => ({
  getOrderForStatusByIdMock: vi.fn(),
  getOrderStatusDetailsByIdMock: vi.fn(),
  getOrderStatusDetailsWithItemsByIdMock: vi.fn(),
  updateOrderGatewayDataMock: vi.fn(),
  updateOrderPaymentStatusMock: vi.fn(),
  markDiscountRedemptionSucceededMock: vi.fn(),
  markDiscountRedemptionVoidMock: vi.fn(),
  createVoucherOnPaymentSuccessMock: vi.fn(),
  checkScalevPaymentStatusMock: vi.fn(),
  checkScalevSettlementStatusMock: vi.fn(),
  getScalevOrderByPgReferenceMock: vi.fn(),
  retrieveScalevOrderMock: vi.fn(),
  buildPaymentSnapshotMock: vi.fn(),
  buildPublicOrderStatusMock: vi.fn(),
  buildPublicOrderStatusWithItemsMock: vi.fn(),
}));

vi.mock("@/lib/payment/order-status-reads", () => ({
  getOrderForStatusById: getOrderForStatusByIdMock,
  getOrderStatusDetailsById: getOrderStatusDetailsByIdMock,
  getOrderStatusDetailsWithItemsById: getOrderStatusDetailsWithItemsByIdMock,
}));

vi.mock("@/lib/payment/order-writes", () => ({
  updateOrderGatewayData: updateOrderGatewayDataMock,
  updateOrderPaymentStatus: updateOrderPaymentStatusMock,
}));

vi.mock("@/lib/payment/voucher-service", () => ({
  createVoucherOnPaymentSuccess: createVoucherOnPaymentSuccessMock,
}));

vi.mock("@/lib/discounts/service", () => ({
  markDiscountRedemptionSucceeded: markDiscountRedemptionSucceededMock,
  markDiscountRedemptionVoid: markDiscountRedemptionVoidMock,
}));

vi.mock("@/lib/scalev/client", () => ({
  checkScalevPaymentStatus: checkScalevPaymentStatusMock,
  checkScalevSettlementStatus: checkScalevSettlementStatusMock,
  getScalevOrderByPgReference: getScalevOrderByPgReferenceMock,
  retrieveScalevOrder: retrieveScalevOrderMock,
}));

vi.mock("@/lib/scalev/mappers", () => ({
  buildPaymentSnapshot: buildPaymentSnapshotMock,
  buildPublicOrderStatus: buildPublicOrderStatusMock,
  buildPublicOrderStatusWithItems: buildPublicOrderStatusWithItemsMock,
}));

describe("reconcilePublicOrderStatusByInternalOrderId", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    updateOrderGatewayDataMock.mockResolvedValue(true);
    updateOrderPaymentStatusMock.mockResolvedValue(true);
    markDiscountRedemptionSucceededMock.mockResolvedValue(true);
    markDiscountRedemptionVoidMock.mockResolvedValue(true);
    createVoucherOnPaymentSuccessMock.mockResolvedValue({ success: true, voucherCount: 1 });
    checkScalevPaymentStatusMock.mockResolvedValue(null);
    checkScalevSettlementStatusMock.mockResolvedValue(null);
    getScalevOrderByPgReferenceMock.mockResolvedValue(null);
    retrieveScalevOrderMock.mockResolvedValue(null);
    buildPublicOrderStatusMock.mockReturnValue({ status: "completed", voucher: {} });
    buildPublicOrderStatusWithItemsMock.mockReturnValue({ status: "completed", vouchers: [] });
  });

  test("returns existing completed multi-item status without re-checking Scalev", async () => {
    const { reconcilePublicOrderStatusByInternalOrderId } = await import("@/lib/scalev/reconcile");

    getOrderForStatusByIdMock.mockResolvedValue({
      id: "order-1",
      payment_order_id: "KSP-123",
    });
    getOrderStatusDetailsWithItemsByIdMock.mockResolvedValue({
      order_items: [
        {
          id: "item-1",
          voucher_id: "voucher-1",
          vouchers: { id: "voucher-1" },
        },
      ],
    });
    getOrderStatusDetailsByIdMock.mockResolvedValue({
      id: "order-1",
      payment_status: "COMPLETED",
      payment_provider: "scalev",
      voucher_id: "voucher-1",
      vouchers: { id: "voucher-1" },
    });
    buildPublicOrderStatusWithItemsMock.mockReturnValue({
      status: "completed",
      vouchers: [{ voucherCode: "KSPV-001" }],
    });

    const result = await reconcilePublicOrderStatusByInternalOrderId("order-1");

    expect(result).toEqual({
      status: "completed",
      vouchers: [{ voucherCode: "KSPV-001" }],
    });
    expect(checkScalevPaymentStatusMock).not.toHaveBeenCalled();
    expect(createVoucherOnPaymentSuccessMock).not.toHaveBeenCalled();
  });

  test("fulfills pending orders after Scalev reconciliation marks them completed", async () => {
    const { reconcilePublicOrderStatusByInternalOrderId } = await import("@/lib/scalev/reconcile");

    getOrderForStatusByIdMock
      .mockResolvedValueOnce({
        id: "order-1",
        payment_order_id: "KSP-123",
      })
      .mockResolvedValueOnce({
        id: "order-1",
        payment_order_id: "KSP-123",
      });
    getOrderStatusDetailsByIdMock.mockResolvedValue({
      id: "order-1",
      payment_status: "PENDING",
      payment_provider: "scalev",
      payment_link: "https://app.scalev.id/order/public/secret-token",
      payment_transaction_id: null,
      scalev_order_pk: 99,
      scalev_order_id: "scalev-1",
      scalev_pg_reference_id: "pg-1",
      scalev_payment_method: "qris",
      scalev_sub_payment_method: null,
      scalev_store_unique_id: "store-1",
      voucher_id: null,
      vouchers: null,
    });
    getOrderStatusDetailsWithItemsByIdMock
      .mockResolvedValueOnce({
        order_items: [{ id: "item-1", voucher_id: null }],
      })
      .mockResolvedValueOnce({
        order_items: [{ id: "item-1", voucher_id: null }],
      })
      .mockResolvedValueOnce({
        order_items: [{ id: "item-1", voucher_id: "voucher-1" }],
      });
    buildPaymentSnapshotMock.mockReturnValue({
      normalizedStatus: "COMPLETED",
      pgReferenceId: "pg-1",
      paymentMethod: "qris",
      subPaymentMethod: null,
      paymentLink: "https://app.scalev.id/order/public/secret-token",
      orderPk: 99,
      orderId: "scalev-1",
      rawStatus: "paid",
      rawPaymentStatus: "paid",
      paymentInstructions: undefined,
    });
    buildPublicOrderStatusWithItemsMock.mockReturnValue({
      status: "completed",
      vouchers: [{ voucherCode: "KSPV-001" }],
    });

    const result = await reconcilePublicOrderStatusByInternalOrderId("order-1");

    expect(updateOrderPaymentStatusMock).toHaveBeenCalledWith(
      "order-1",
      "COMPLETED",
      expect.any(Object)
    );
    expect(createVoucherOnPaymentSuccessMock).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "order-1",
      })
    );
    expect(result).toEqual({
      status: "completed",
      vouchers: [{ voucherCode: "KSPV-001" }],
    });
  });

  test("throws before fulfillment when discount redemption sync fails after completion", async () => {
    const { reconcilePublicOrderStatusByInternalOrderId } = await import("@/lib/scalev/reconcile");

    getOrderForStatusByIdMock.mockResolvedValue({
      id: "order-1",
      payment_order_id: "KSP-123",
    });
    getOrderStatusDetailsByIdMock.mockResolvedValue({
      id: "order-1",
      payment_status: "PENDING",
      payment_provider: "scalev",
      payment_link: "https://app.scalev.id/order/public/secret-token",
      payment_transaction_id: null,
      scalev_order_pk: 99,
      scalev_order_id: "scalev-1",
      scalev_pg_reference_id: "pg-1",
      scalev_payment_method: "qris",
      scalev_sub_payment_method: null,
      scalev_store_unique_id: "store-1",
      voucher_id: null,
      vouchers: null,
    });
    getOrderStatusDetailsWithItemsByIdMock.mockResolvedValue({
      order_items: [{ id: "item-1", voucher_id: null }],
    });
    buildPaymentSnapshotMock.mockReturnValue({
      normalizedStatus: "COMPLETED",
      pgReferenceId: "pg-1",
      paymentMethod: "qris",
      subPaymentMethod: null,
      paymentLink: "https://app.scalev.id/order/public/secret-token",
      orderPk: 99,
      orderId: "scalev-1",
      rawStatus: "paid",
      rawPaymentStatus: "paid",
      paymentInstructions: undefined,
    });
    markDiscountRedemptionSucceededMock.mockResolvedValue(false);

    await expect(
      reconcilePublicOrderStatusByInternalOrderId("order-1")
    ).rejects.toThrow("Failed to synchronize discount redemption after payment success.");
    expect(createVoucherOnPaymentSuccessMock).not.toHaveBeenCalled();
  });

  test("throws when voiding discount redemption fails after failed payment", async () => {
    const { reconcilePublicOrderStatusByInternalOrderId } = await import("@/lib/scalev/reconcile");

    getOrderForStatusByIdMock.mockResolvedValue({
      id: "order-1",
      payment_order_id: "KSP-123",
    });
    getOrderStatusDetailsByIdMock.mockResolvedValue({
      id: "order-1",
      payment_status: "PENDING",
      payment_provider: "scalev",
      payment_link: "https://app.scalev.id/order/public/secret-token",
      payment_transaction_id: null,
      scalev_order_pk: 99,
      scalev_order_id: "scalev-1",
      scalev_pg_reference_id: "pg-1",
      scalev_payment_method: "qris",
      scalev_sub_payment_method: null,
      scalev_store_unique_id: "store-1",
      voucher_id: null,
      vouchers: null,
    });
    getOrderStatusDetailsWithItemsByIdMock.mockResolvedValue({
      order_items: [{ id: "item-1", voucher_id: null }],
    });
    buildPaymentSnapshotMock.mockReturnValue({
      normalizedStatus: "FAILED",
      pgReferenceId: "pg-1",
      paymentMethod: "qris",
      subPaymentMethod: null,
      paymentLink: "https://app.scalev.id/order/public/secret-token",
      orderPk: 99,
      orderId: "scalev-1",
      rawStatus: "expired",
      rawPaymentStatus: "expired",
      paymentInstructions: undefined,
    });
    markDiscountRedemptionVoidMock.mockResolvedValue(false);

    await expect(
      reconcilePublicOrderStatusByInternalOrderId("order-1")
    ).rejects.toThrow("Failed to void discount redemption after payment failure.");
  });
});
