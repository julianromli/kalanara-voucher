import { beforeEach, describe, expect, test, vi } from "vitest";

const {
  getOrderByPaymentOrderIdAndAccessTokenMock,
  getPublicOrderDetailsMock,
  getPublicOrderDetailsWithItemsMock,
  updateOrderGatewayDataMock,
  updateOrderPaymentStatusMock,
  createVoucherOnPaymentSuccessMock,
  checkScalevPaymentStatusMock,
  checkScalevSettlementStatusMock,
  getScalevOrderByPgReferenceMock,
  retrieveScalevOrderMock,
  buildPaymentSnapshotMock,
  buildPublicOrderStatusMock,
  buildPublicOrderStatusWithItemsMock,
} = vi.hoisted(() => ({
  getOrderByPaymentOrderIdAndAccessTokenMock: vi.fn(),
  getPublicOrderDetailsMock: vi.fn(),
  getPublicOrderDetailsWithItemsMock: vi.fn(),
  updateOrderGatewayDataMock: vi.fn(),
  updateOrderPaymentStatusMock: vi.fn(),
  createVoucherOnPaymentSuccessMock: vi.fn(),
  checkScalevPaymentStatusMock: vi.fn(),
  checkScalevSettlementStatusMock: vi.fn(),
  getScalevOrderByPgReferenceMock: vi.fn(),
  retrieveScalevOrderMock: vi.fn(),
  buildPaymentSnapshotMock: vi.fn(),
  buildPublicOrderStatusMock: vi.fn(),
  buildPublicOrderStatusWithItemsMock: vi.fn(),
}));

vi.mock("@/lib/actions/orders", () => ({
  getOrderByPaymentOrderIdAndAccessToken: getOrderByPaymentOrderIdAndAccessTokenMock,
  getPublicOrderDetails: getPublicOrderDetailsMock,
  getPublicOrderDetailsWithItems: getPublicOrderDetailsWithItemsMock,
  updateOrderGatewayData: updateOrderGatewayDataMock,
  updateOrderPaymentStatus: updateOrderPaymentStatusMock,
}));

vi.mock("@/lib/payment/voucher-service", () => ({
  createVoucherOnPaymentSuccess: createVoucherOnPaymentSuccessMock,
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

describe("reconcilePublicOrderStatus", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    updateOrderGatewayDataMock.mockResolvedValue(true);
    updateOrderPaymentStatusMock.mockResolvedValue(true);
    createVoucherOnPaymentSuccessMock.mockResolvedValue({ success: true, voucherCount: 1 });
    checkScalevPaymentStatusMock.mockResolvedValue(null);
    checkScalevSettlementStatusMock.mockResolvedValue(null);
    getScalevOrderByPgReferenceMock.mockResolvedValue(null);
    retrieveScalevOrderMock.mockResolvedValue(null);
    buildPublicOrderStatusMock.mockReturnValue({ status: "completed", voucher: {} });
    buildPublicOrderStatusWithItemsMock.mockReturnValue({ status: "completed", vouchers: [] });
  });

  test("returns existing completed multi-item status without re-checking Scalev", async () => {
    const { reconcilePublicOrderStatus } = await import("@/lib/scalev/reconcile");

    getOrderByPaymentOrderIdAndAccessTokenMock.mockResolvedValue({
      id: "order-1",
      payment_order_id: "KSP-123",
    });
    getPublicOrderDetailsWithItemsMock.mockResolvedValue({
      order_items: [
        {
          id: "item-1",
          voucher_id: "voucher-1",
          vouchers: { id: "voucher-1" },
        },
      ],
    });
    getPublicOrderDetailsMock.mockResolvedValue({
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

    const result = await reconcilePublicOrderStatus("KSP-123", "public-token");

    expect(result).toEqual({
      status: "completed",
      vouchers: [{ voucherCode: "KSPV-001" }],
    });
    expect(checkScalevPaymentStatusMock).not.toHaveBeenCalled();
    expect(createVoucherOnPaymentSuccessMock).not.toHaveBeenCalled();
  });

  test("fulfills pending orders after Scalev reconciliation marks them completed", async () => {
    const { reconcilePublicOrderStatus } = await import("@/lib/scalev/reconcile");

    getOrderByPaymentOrderIdAndAccessTokenMock
      .mockResolvedValueOnce({
        id: "order-1",
        payment_order_id: "KSP-123",
      })
      .mockResolvedValueOnce({
        id: "order-1",
        payment_order_id: "KSP-123",
      });
    getPublicOrderDetailsMock.mockResolvedValue({
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
    getPublicOrderDetailsWithItemsMock
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

    const result = await reconcilePublicOrderStatus("KSP-123", "public-token");

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
});
