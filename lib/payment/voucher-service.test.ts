import { beforeEach, describe, expect, test, vi } from "vitest";

const {
  createVoucherMock,
  getVoucherBySourceOrderIdMock,
  getVoucherBySourceOrderItemIdMock,
  updateOrderVoucherIdMock,
  getOrderItemsByOrderIdMock,
  updateOrderItemVoucherIdMock,
} = vi.hoisted(() => ({
  createVoucherMock: vi.fn(),
  getVoucherBySourceOrderIdMock: vi.fn(),
  getVoucherBySourceOrderItemIdMock: vi.fn(),
  updateOrderVoucherIdMock: vi.fn(),
  getOrderItemsByOrderIdMock: vi.fn(),
  updateOrderItemVoucherIdMock: vi.fn(),
}));

vi.mock("@/lib/actions/vouchers", () => ({
  createVoucher: createVoucherMock,
  getVoucherBySourceOrderId: getVoucherBySourceOrderIdMock,
  getVoucherBySourceOrderItemId: getVoucherBySourceOrderItemIdMock,
}));

vi.mock("@/lib/actions/orders", () => ({
  updateOrderVoucherId: updateOrderVoucherIdMock,
  getOrderItemsByOrderId: getOrderItemsByOrderIdMock,
  updateOrderItemVoucherId: updateOrderItemVoucherIdMock,
}));

describe("createVoucherOnPaymentSuccess", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NEXT_PUBLIC_APP_URL = "https://voucher.kalanaraspa.com";
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        text: async () => "",
      })
    );

    getVoucherBySourceOrderIdMock.mockResolvedValue(null);
    getVoucherBySourceOrderItemIdMock.mockResolvedValue(null);
    createVoucherMock.mockResolvedValue({
      id: "voucher-1",
      code: "KSPV-001",
    });
    updateOrderVoucherIdMock.mockResolvedValue(true);
    updateOrderItemVoucherIdMock.mockResolvedValue(true);
    getOrderItemsByOrderIdMock.mockResolvedValue([]);
  });

  test("uses purchaser contact as effective delivery target when send_to is PURCHASER", async () => {
    const { createVoucherOnPaymentSuccess } = await import(
      "@/lib/payment/voucher-service"
    );

    const result = await createVoucherOnPaymentSuccess({
      id: "order-1",
      voucher_id: null,
      service_id: "service-1",
      recipient_name: "Penerima",
      recipient_email: null,
      recipient_phone: null,
      customer_email: "buyer@example.com",
      customer_phone: "6281234567890",
      customer_name: "Faiz",
      sender_message: "Selamat menikmati",
      total_amount: 450000,
      payment_order_id: "KSP-123",
      public_access_token: "public-token",
      delivery_method: "WHATSAPP",
      send_to: "PURCHASER",
    } as never);

    expect(result).toEqual({
      success: true,
      voucherId: "voucher-1",
      voucherCode: "KSPV-001",
      voucherCount: 1,
    });
    expect(createVoucherMock).toHaveBeenCalledWith(
      expect.objectContaining({
        recipient_name: "Penerima",
        recipient_email: "buyer@example.com",
      })
    );
    expect(fetch).toHaveBeenCalledWith(
      "https://voucher.kalanaraspa.com/api/whatsapp/send-voucher",
      expect.objectContaining({
        method: "POST",
      })
    );
  });
});
