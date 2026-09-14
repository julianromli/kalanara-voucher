import { beforeEach, describe, expect, test, vi } from "vitest";

const { getPublicOrderDetailsWithItemsMock } = vi.hoisted(() => ({
  getPublicOrderDetailsWithItemsMock: vi.fn(),
}));

vi.mock("@/lib/payment/order-capability-reads", () => ({
  getPublicOrderDetailsWithItems: getPublicOrderDetailsWithItemsMock,
}));

describe("authorized voucher delivery", () => {
  beforeEach(() => vi.clearAllMocks());

  test("returns the root voucher for a legacy order without order_items", async () => {
    getPublicOrderDetailsWithItemsMock.mockResolvedValue({
      id: "order-1",
      payment_order_id: "KSP-1",
      public_access_token: "token",
      payment_status: "COMPLETED",
      customer_phone: "62812",
      recipient_phone: "62813",
      send_to: "RECIPIENT",
      vouchers: {
        code: "KSPV-1",
        recipient_email: "recipient@example.com",
        recipient_name: "Penerima",
        sender_name: "Pengirim",
        sender_message: null,
        amount: 450000,
        expiry_date: "2027-09-14",
        services: { name: "Spa", duration: 60 },
      },
      order_items: [],
    });
    const { getAuthorizedVoucherDeliveries } = await import(
      "@/lib/payment/public-voucher-delivery"
    );

    await expect(
      getAuthorizedVoucherDeliveries("KSP-1", "token")
    ).resolves.toEqual([
      expect.objectContaining({ voucherCode: "KSPV-1" }),
    ]);
  });
});
