import { beforeEach, describe, expect, test, vi } from "vitest";

const {
  getOrderForStatusByIdMock,
  getOrderStatusDetailsByIdMock,
  getOrderStatusDetailsWithItemsByIdMock,
  transitionOrderPaymentStateMock,
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
  transitionOrderPaymentStateMock: vi.fn(),
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

vi.mock("@/lib/payment/payment-state", () => ({
  transitionOrderPaymentState: transitionOrderPaymentStateMock,
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
    transitionOrderPaymentStateMock.mockImplementation(
      async ({ targetStatus }: { targetStatus: string }) => ({
        accepted: true,
        changed: true,
        reason: "applied",
        previousStatus: "PENDING",
        currentStatus: targetStatus,
        stateVersion: 1,
      })
    );
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

  test("re-enters delivery for completed linked vouchers without re-checking Scalev", async () => {
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
    expect(createVoucherOnPaymentSuccessMock).toHaveBeenCalledWith(
      expect.objectContaining({ id: "order-1" })
    );
  });

  test("reloads public status after completing a partially fulfilled order", async () => {
    const { reconcilePublicOrderStatusByInternalOrderId } = await import(
      "@/lib/scalev/reconcile"
    );
    const partialOrder = {
      id: "order-1",
      payment_status: "COMPLETED",
      order_items: [
        { id: "item-1", voucher_id: "voucher-1", vouchers: { code: "KSPV-001" } },
        { id: "item-2", voucher_id: null, vouchers: null },
      ],
    };
    const fulfilledOrder = {
      ...partialOrder,
      order_items: [
        partialOrder.order_items[0],
        { id: "item-2", voucher_id: "voucher-2", vouchers: { code: "KSPV-002" } },
      ],
    };
    const publicOrder = {
      id: "order-1",
      payment_status: "COMPLETED",
      payment_provider: "scalev",
      vouchers: null,
    };

    getOrderForStatusByIdMock.mockResolvedValue({
      id: "order-1",
      payment_order_id: "KSP-123",
    });
    getOrderStatusDetailsWithItemsByIdMock
      .mockResolvedValueOnce(partialOrder)
      .mockResolvedValueOnce(fulfilledOrder);
    getOrderStatusDetailsByIdMock.mockResolvedValue(publicOrder);
    buildPublicOrderStatusWithItemsMock.mockImplementation(
      (orderWithItems: typeof partialOrder) => ({
        status: orderWithItems === fulfilledOrder ? "completed" : "pending",
        vouchers: orderWithItems.order_items.flatMap((item) =>
          item.vouchers ? [item.vouchers] : []
        ),
      })
    );

    await expect(
      reconcilePublicOrderStatusByInternalOrderId("order-1")
    ).resolves.toEqual({
      status: "completed",
      vouchers: [{ code: "KSPV-001" }, { code: "KSPV-002" }],
    });
    expect(getOrderStatusDetailsWithItemsByIdMock).toHaveBeenCalledTimes(2);
    expect(createVoucherOnPaymentSuccessMock).toHaveBeenCalledOnce();
    expect(checkScalevPaymentStatusMock).not.toHaveBeenCalled();
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
        payment_status: "COMPLETED",
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
      providerEventAt: "2026-09-14T11:58:00.000Z",
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

    expect(transitionOrderPaymentStateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        orderId: "order-1",
        targetStatus: "COMPLETED",
        provider: "scalev",
        providerEventAt: "2026-09-14T11:58:00.000Z",
        providerEventAtIsFallback: false,
        gatewayUpdate: expect.objectContaining({
          transactionTime: "2026-09-14T11:58:00.000Z",
          paymentLink: "https://app.scalev.id/order/public/secret-token",
          scalevLastCheckedAt: expect.any(String),
        }),
      })
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

  test.each([
    "not_found",
    "missing_provider_event_at",
    "version_conflict",
    "stale_provider_event",
    "transition_rejected",
    "database_error",
  ] as const)("stops downstream work when transition returns %s", async (reason) => {
    const { reconcilePublicOrderStatusByInternalOrderId } = await import(
      "@/lib/scalev/reconcile"
    );
    getOrderForStatusByIdMock.mockResolvedValue({
      id: "order-1",
      payment_order_id: "KSP-123",
    });
    getOrderStatusDetailsByIdMock.mockResolvedValue({
      id: "order-1",
      payment_status: "PENDING",
      payment_provider: "scalev",
      scalev_order_pk: 99,
      scalev_pg_reference_id: "pg-1",
      voucher_id: null,
      vouchers: null,
    });
    getOrderStatusDetailsWithItemsByIdMock.mockResolvedValue({
      order_items: [{ id: "item-1", voucher_id: null }],
    });
    buildPaymentSnapshotMock.mockReturnValue({
      normalizedStatus: "COMPLETED",
      providerEventAt: "2026-09-14T11:58:00.000Z",
      pgReferenceId: "pg-1",
      orderPk: 99,
      rawStatus: "paid",
      rawPaymentStatus: "paid",
    });
    transitionOrderPaymentStateMock.mockResolvedValue({
      accepted: false,
      changed: false,
      reason,
    });
    buildPublicOrderStatusWithItemsMock.mockReturnValue({
      status: "pending",
      vouchers: [],
    });

    await expect(
      reconcilePublicOrderStatusByInternalOrderId("order-1")
    ).resolves.toEqual({ status: "pending", vouchers: [] });
    expect(markDiscountRedemptionSucceededMock).not.toHaveBeenCalled();
    expect(markDiscountRedemptionVoidMock).not.toHaveBeenCalled();
    expect(createVoucherOnPaymentSuccessMock).not.toHaveBeenCalled();
  });

  test("accepted idempotent completion may retry fulfillment from a re-fetched order", async () => {
    const { reconcilePublicOrderStatusByInternalOrderId } = await import(
      "@/lib/scalev/reconcile"
    );
    getOrderForStatusByIdMock
      .mockResolvedValueOnce({ id: "order-1", payment_order_id: "KSP-123" })
      .mockResolvedValueOnce({
        id: "order-1",
        payment_order_id: "KSP-123",
        payment_status: "COMPLETED",
      });
    getOrderStatusDetailsByIdMock.mockResolvedValue({
      id: "order-1",
      payment_status: "COMPLETED",
      payment_provider: "scalev",
      scalev_order_pk: 99,
      scalev_pg_reference_id: "pg-1",
      voucher_id: null,
      vouchers: null,
    });
    getOrderStatusDetailsWithItemsByIdMock
      .mockResolvedValueOnce({ order_items: [{ id: "item-1", voucher_id: null }] })
      .mockResolvedValueOnce({ order_items: [{ id: "item-1", voucher_id: null }] })
      .mockResolvedValueOnce({
        order_items: [{ id: "item-1", voucher_id: "voucher-1" }],
      });
    buildPaymentSnapshotMock.mockReturnValue({
      normalizedStatus: "COMPLETED",
      providerEventAt: "2026-09-14T11:58:00.000Z",
      orderPk: 99,
      rawStatus: "paid",
      rawPaymentStatus: "paid",
    });
    transitionOrderPaymentStateMock.mockResolvedValue({
      accepted: true,
      changed: false,
      reason: "idempotent",
      previousStatus: "COMPLETED",
      currentStatus: "COMPLETED",
      stateVersion: 8,
    });

    await reconcilePublicOrderStatusByInternalOrderId("order-1");

    expect(createVoucherOnPaymentSuccessMock).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "order-1",
        payment_status: "COMPLETED",
      })
    );
  });

  test("preserves a payment link discovered during pg-reference lookup", async () => {
    const { reconcilePublicOrderStatusByInternalOrderId } = await import(
      "@/lib/scalev/reconcile"
    );
    getOrderForStatusByIdMock.mockResolvedValue({ id: "order-1" });
    getOrderStatusDetailsWithItemsByIdMock.mockResolvedValue({
      order_items: [],
    });
    getOrderStatusDetailsByIdMock.mockResolvedValue({
      id: "order-1",
      payment_status: "PENDING",
      payment_provider: "scalev",
      scalev_order_pk: null,
      scalev_pg_reference_id: "pg-1",
      payment_link: null,
    });
    getScalevOrderByPgReferenceMock.mockResolvedValue({
      id: 99,
      payment_link: "https://app.scalev.id/discovered",
    });
    buildPaymentSnapshotMock
      .mockReturnValueOnce({
        normalizedStatus: "PENDING",
        paymentLink: "https://app.scalev.id/discovered",
      })
      .mockReturnValueOnce({
        normalizedStatus: "PENDING",
        providerEventAt: "2026-09-14T11:58:00.000Z",
        paymentLink: null,
      });

    await reconcilePublicOrderStatusByInternalOrderId("order-1");

    expect(transitionOrderPaymentStateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        gatewayUpdate: expect.objectContaining({
          paymentLink: "https://app.scalev.id/discovered",
        }),
      })
    );
  });
});
