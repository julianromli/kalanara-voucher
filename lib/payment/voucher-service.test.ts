import { beforeEach, describe, expect, test, vi } from "vitest";
import type {
  OrderItemWithService,
  OrderWithService,
} from "@/lib/database.types";

const {
  claimVoucherDeliveriesMock,
  createVoucherForPaidOrderMock,
  createVoucherForPaidOrderItemMock,
  markVoucherDeliveryFailedMock,
  markVoucherDeliveryHandoffRequiredMock,
  markVoucherDeliverySentMock,
  sendVoucherEmailMock,
  sendVoucherWhatsAppMock,
  updateOrderVoucherIdMock,
  getOrderItemsByOrderIdMock,
  listVoucherDeliveryChannelsMock,
} = vi.hoisted(() => ({
  claimVoucherDeliveriesMock: vi.fn(),
  createVoucherForPaidOrderMock: vi.fn(),
  createVoucherForPaidOrderItemMock: vi.fn(),
  markVoucherDeliveryFailedMock: vi.fn(),
  markVoucherDeliveryHandoffRequiredMock: vi.fn(),
  markVoucherDeliverySentMock: vi.fn(),
  sendVoucherEmailMock: vi.fn(),
  sendVoucherWhatsAppMock: vi.fn(),
  updateOrderVoucherIdMock: vi.fn(),
  getOrderItemsByOrderIdMock: vi.fn(),
  listVoucherDeliveryChannelsMock: vi.fn(),
}));

vi.mock("@/lib/payment/voucher-writes", () => ({
  createVoucherForPaidOrder: createVoucherForPaidOrderMock,
  createVoucherForPaidOrderItem: createVoucherForPaidOrderItemMock,
}));

vi.mock("@/lib/actions/orders", () => ({
  getOrderItemsByOrderId: getOrderItemsByOrderIdMock,
}));

vi.mock("@/lib/payment/order-writes", () => ({
  updateOrderVoucherId: updateOrderVoucherIdMock,
}));

vi.mock("@/lib/payment/voucherDeliveryOutbox", () => ({
  claimVoucherDeliveries: claimVoucherDeliveriesMock,
  listVoucherDeliveryChannels: listVoucherDeliveryChannelsMock,
  markVoucherDeliveryFailed: markVoucherDeliveryFailedMock,
  markVoucherDeliveryHandoffRequired: markVoucherDeliveryHandoffRequiredMock,
  markVoucherDeliverySent: markVoucherDeliverySentMock,
}));

vi.mock("@/lib/payment/public-voucher-delivery", () => ({
  sendVoucherEmail: sendVoucherEmailMock,
  sendVoucherWhatsApp: sendVoucherWhatsAppMock,
}));

const order = {
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
} as unknown as OrderWithService;

const item = {
  id: "item-1",
  order_id: "order-1",
  service_id: "service-1",
  voucher_id: null,
  vouchers: null,
  recipient_name: "Penerima",
  recipient_email: "recipient@example.com",
  recipient_phone: "628111111111",
  sender_message: "Selamat menikmati",
  delivery_method: "BOTH",
  send_to: "RECIPIENT",
} as unknown as OrderItemWithService;

describe("createVoucherOnPaymentSuccess", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    createVoucherForPaidOrderMock.mockResolvedValue({
      id: "voucher-1",
      code: "KSPV-001",
    });
    createVoucherForPaidOrderItemMock.mockResolvedValue({
      id: "voucher-1",
      code: "KSPV-001",
    });
    claimVoucherDeliveriesMock.mockResolvedValue([
      { id: "delivery-whatsapp", channel: "WHATSAPP", claimToken: "claim-1" },
    ]);
    markVoucherDeliveryFailedMock.mockResolvedValue(undefined);
    markVoucherDeliveryHandoffRequiredMock.mockResolvedValue(undefined);
    markVoucherDeliverySentMock.mockResolvedValue(undefined);
    sendVoucherEmailMock.mockResolvedValue(undefined);
    sendVoucherWhatsAppMock.mockResolvedValue(
      "https://wa.me/628123456789?text=Voucher"
    );
    updateOrderVoucherIdMock.mockResolvedValue(true);
    getOrderItemsByOrderIdMock.mockResolvedValue([]);
  });

  test("uses purchaser contact as effective delivery target when send_to is PURCHASER", async () => {
    const { createVoucherOnPaymentSuccess } = await import(
      "@/lib/payment/voucher-service"
    );

    const result = await createVoucherOnPaymentSuccess(order);

    expect(result).toEqual({
      success: true,
      voucherId: "voucher-1",
      voucherCode: "KSPV-001",
      voucherCount: 1,
    });
    expect(createVoucherForPaidOrderMock).toHaveBeenCalledWith("order-1");
    expect(claimVoucherDeliveriesMock).toHaveBeenCalledWith({
      orderId: "order-1",
      orderItemId: null,
      voucherId: "voucher-1",
      channels: ["WHATSAPP"],
    });
    expect(sendVoucherWhatsAppMock).toHaveBeenCalledWith(
      "KSP-123",
      "public-token",
      undefined
    );
    expect(markVoucherDeliveryHandoffRequiredMock).toHaveBeenCalledWith(
      "delivery-whatsapp",
      "claim-1",
      "https://wa.me/628123456789?text=Voucher"
    );
    expect(markVoucherDeliverySentMock).not.toHaveBeenCalled();
  });

  test("concurrent duplicate fulfillment calls send one claimed channel once", async () => {
    const { createVoucherOnPaymentSuccess } = await import(
      "@/lib/payment/voucher-service"
    );
    claimVoucherDeliveriesMock
      .mockResolvedValueOnce([
        { id: "delivery-1", channel: "WHATSAPP", claimToken: "claim-1" },
      ])
      .mockResolvedValueOnce([]);

    const results = await Promise.all([
      createVoucherOnPaymentSuccess(order),
      createVoucherOnPaymentSuccess(order),
    ]);

    expect(results.every((result) => result.success)).toBe(true);
    expect(claimVoucherDeliveriesMock).toHaveBeenCalledTimes(2);
    expect(sendVoucherWhatsAppMock).toHaveBeenCalledTimes(1);
    expect(markVoucherDeliveryHandoffRequiredMock).toHaveBeenCalledTimes(1);
    expect(markVoucherDeliverySentMock).not.toHaveBeenCalled();
  });

  test("claims and persists both item delivery channels", async () => {
    const { createVoucherOnPaymentSuccess } = await import(
      "@/lib/payment/voucher-service"
    );
    getOrderItemsByOrderIdMock.mockResolvedValue([item]);
    claimVoucherDeliveriesMock.mockResolvedValue([
      { id: "delivery-email", channel: "EMAIL", claimToken: "claim-email" },
      {
        id: "delivery-whatsapp",
        channel: "WHATSAPP",
        claimToken: "claim-whatsapp",
      },
    ]);

    const result = await createVoucherOnPaymentSuccess(order);

    expect(result.success).toBe(true);
    expect(claimVoucherDeliveriesMock).toHaveBeenCalledWith({
      orderId: "order-1",
      orderItemId: "item-1",
      voucherId: "voucher-1",
      channels: ["EMAIL", "WHATSAPP"],
    });
    expect(sendVoucherEmailMock).toHaveBeenCalledWith(
      "KSP-123",
      "public-token",
      "item-1"
    );
    expect(sendVoucherWhatsAppMock).toHaveBeenCalledWith(
      "KSP-123",
      "public-token",
      "item-1"
    );
    expect(markVoucherDeliverySentMock).toHaveBeenCalledWith(
      "delivery-email",
      "claim-email"
    );
    expect(markVoucherDeliveryHandoffRequiredMock).toHaveBeenCalledWith(
      "delivery-whatsapp",
      "claim-whatsapp",
      "https://wa.me/628123456789?text=Voucher"
    );
  });

  test("reuses an item voucher and does not send when its delivery is already claimed or sent", async () => {
    const { createVoucherOnPaymentSuccess } = await import(
      "@/lib/payment/voucher-service"
    );
    const existingVoucher = { id: "voucher-existing", code: "KSPV-OLD" };
    getOrderItemsByOrderIdMock.mockResolvedValue([
      {
        ...item,
        voucher_id: existingVoucher.id,
        vouchers: existingVoucher,
      },
    ]);
    claimVoucherDeliveriesMock.mockResolvedValue([]);

    const result = await createVoucherOnPaymentSuccess(order);

    expect(result).toEqual({
      success: true,
      voucherId: "voucher-existing",
      voucherCode: "KSPV-OLD",
      voucherCount: 1,
    });
    expect(createVoucherForPaidOrderItemMock).not.toHaveBeenCalled();
    expect(sendVoucherEmailMock).not.toHaveBeenCalled();
    expect(sendVoucherWhatsAppMock).not.toHaveBeenCalled();
  });

  test("loads the concrete voucher for a legacy no-item order before claiming", async () => {
    const { createVoucherOnPaymentSuccess } = await import(
      "@/lib/payment/voucher-service"
    );
    createVoucherForPaidOrderMock.mockResolvedValue({
      id: "voucher-existing",
      code: "KSPV-OLD",
    });

    const result = await createVoucherOnPaymentSuccess({
      ...order,
      voucher_id: "voucher-existing",
    });

    expect(result.success).toBe(true);
    expect(createVoucherForPaidOrderMock).toHaveBeenCalledWith("order-1");
    expect(claimVoucherDeliveriesMock).toHaveBeenCalledWith(
      expect.objectContaining({
        orderItemId: null,
        voucherId: "voucher-existing",
      })
    );
  });

  test("marks a claimed delivery failed before surfacing the send failure", async () => {
    const { createVoucherOnPaymentSuccess } = await import(
      "@/lib/payment/voucher-service"
    );
    const sendError = new Error("provider unavailable");
    sendVoucherWhatsAppMock.mockRejectedValue(sendError);

    const result = await createVoucherOnPaymentSuccess(order);

    expect(markVoucherDeliveryFailedMock).toHaveBeenCalledWith(
      "delivery-whatsapp",
      "claim-1",
      sendError
    );
    expect(markVoucherDeliverySentMock).not.toHaveBeenCalled();
    expect(markVoucherDeliveryHandoffRequiredMock).not.toHaveBeenCalled();
    expect(result).toEqual({
      success: false,
      error: "provider unavailable",
    });
  });

  test("claims every configured channel and marks each failed when public credentials are missing", async () => {
    const { createVoucherOnPaymentSuccess } = await import(
      "@/lib/payment/voucher-service"
    );
    getOrderItemsByOrderIdMock.mockResolvedValue([item]);
    claimVoucherDeliveriesMock.mockResolvedValue([
      { id: "delivery-email", channel: "EMAIL", claimToken: "claim-email" },
      {
        id: "delivery-whatsapp",
        channel: "WHATSAPP",
        claimToken: "claim-whatsapp",
      },
    ]);

    const result = await createVoucherOnPaymentSuccess({
      ...order,
      payment_order_id: null,
      public_access_token: null,
    } as unknown as OrderWithService);

    expect(claimVoucherDeliveriesMock).toHaveBeenCalledWith({
      orderId: "order-1",
      orderItemId: "item-1",
      voucherId: "voucher-1",
      channels: ["EMAIL", "WHATSAPP"],
    });
    expect(markVoucherDeliveryFailedMock).toHaveBeenCalledTimes(2);
    expect(markVoucherDeliveryFailedMock).toHaveBeenCalledWith(
      "delivery-email",
      "claim-email",
      expect.objectContaining({
        message: "Missing public access credentials for voucher delivery",
      })
    );
    expect(markVoucherDeliveryFailedMock).toHaveBeenCalledWith(
      "delivery-whatsapp",
      "claim-whatsapp",
      expect.objectContaining({
        message: "Missing public access credentials for voucher delivery",
      })
    );
    expect(sendVoucherEmailMock).not.toHaveBeenCalled();
    expect(sendVoucherWhatsAppMock).not.toHaveBeenCalled();
    expect(markVoucherDeliverySentMock).not.toHaveBeenCalled();
    expect(markVoucherDeliveryHandoffRequiredMock).not.toHaveBeenCalled();
    expect(result).toEqual({
      success: false,
      error: "Missing public access credentials for voucher delivery",
    });
  });

  test("does not require delivery credentials when no channel is claimable", async () => {
    const { createVoucherOnPaymentSuccess } = await import(
      "@/lib/payment/voucher-service"
    );
    getOrderItemsByOrderIdMock.mockResolvedValue([item]);
    claimVoucherDeliveriesMock.mockResolvedValue([]);

    const result = await createVoucherOnPaymentSuccess({
      ...order,
      payment_order_id: null,
      public_access_token: null,
    } as unknown as OrderWithService);

    expect(result.success).toBe(true);
    expect(markVoucherDeliveryFailedMock).not.toHaveBeenCalled();
    expect(sendVoucherEmailMock).not.toHaveBeenCalled();
    expect(sendVoucherWhatsAppMock).not.toHaveBeenCalled();
  });
});

describe("buyer copy of a gift voucher", () => {
  const giftVoucher = {
    id: "voucher-1",
    code: "KSPV-001",
    recipient_email: "recipient@example.com",
  };

  beforeEach(() => {
    vi.clearAllMocks();
    createVoucherForPaidOrderItemMock.mockResolvedValue(giftVoucher);
    getOrderItemsByOrderIdMock.mockResolvedValue([item]);
    listVoucherDeliveryChannelsMock.mockResolvedValue([]);
    markVoucherDeliverySentMock.mockResolvedValue(undefined);
    markVoucherDeliveryHandoffRequiredMock.mockResolvedValue(undefined);
    sendVoucherEmailMock.mockResolvedValue(undefined);
    sendVoucherWhatsAppMock.mockResolvedValue("https://wa.me/628111111111?text=Voucher");
    updateOrderVoucherIdMock.mockResolvedValue(true);
  });

  test("a new gift delivery claims and sends the buyer copy", async () => {
    const { createVoucherOnPaymentSuccess } = await import("@/lib/payment/voucher-service");
    claimVoucherDeliveriesMock.mockResolvedValue([
      { id: "delivery-email", channel: "EMAIL", claimToken: "claim-email" },
      { id: "delivery-copy", channel: "EMAIL_BUYER_COPY", claimToken: "claim-copy" },
    ]);

    const result = await createVoucherOnPaymentSuccess(order);

    expect(result.success).toBe(true);
    expect(claimVoucherDeliveriesMock).toHaveBeenCalledWith(
      expect.objectContaining({ channels: ["EMAIL", "WHATSAPP", "EMAIL_BUYER_COPY"] })
    );
    expect(sendVoucherEmailMock).toHaveBeenCalledWith("KSP-123", "public-token", "item-1");
    expect(sendVoucherEmailMock).toHaveBeenCalledWith("KSP-123", "public-token", "item-1", "buyer");
    expect(markVoucherDeliverySentMock).toHaveBeenCalledWith("delivery-copy", "claim-copy");
  });

  test("no copy when the recipient email is the buyer's", async () => {
    const { createVoucherOnPaymentSuccess } = await import("@/lib/payment/voucher-service");
    createVoucherForPaidOrderItemMock.mockResolvedValue({
      ...giftVoucher,
      recipient_email: "Buyer@Example.com",
    });
    claimVoucherDeliveriesMock.mockResolvedValue([]);

    await createVoucherOnPaymentSuccess(order);

    expect(claimVoucherDeliveriesMock).toHaveBeenCalledWith(
      expect.objectContaining({ channels: ["EMAIL", "WHATSAPP"] })
    );
    expect(listVoucherDeliveryChannelsMock).not.toHaveBeenCalled();
  });

  test("a replayed webhook for an order emailed before this change sends no copy", async () => {
    const { createVoucherOnPaymentSuccess } = await import("@/lib/payment/voucher-service");
    listVoucherDeliveryChannelsMock.mockResolvedValue(["EMAIL", "WHATSAPP"]);
    claimVoucherDeliveriesMock.mockResolvedValue([]);

    await createVoucherOnPaymentSuccess(order);

    expect(claimVoucherDeliveriesMock).toHaveBeenCalledWith(
      expect.objectContaining({ channels: ["EMAIL", "WHATSAPP"] })
    );
    expect(sendVoucherEmailMock).not.toHaveBeenCalled();
  });

  test("a failed copy with its own row is retried", async () => {
    const { createVoucherOnPaymentSuccess } = await import("@/lib/payment/voucher-service");
    listVoucherDeliveryChannelsMock.mockResolvedValue(["EMAIL", "WHATSAPP", "EMAIL_BUYER_COPY"]);
    claimVoucherDeliveriesMock.mockResolvedValue([
      { id: "delivery-copy", channel: "EMAIL_BUYER_COPY", claimToken: "claim-copy" },
    ]);

    await createVoucherOnPaymentSuccess(order);

    expect(claimVoucherDeliveriesMock).toHaveBeenCalledWith(
      expect.objectContaining({ channels: ["EMAIL", "WHATSAPP", "EMAIL_BUYER_COPY"] })
    );
    expect(sendVoucherEmailMock).toHaveBeenCalledTimes(1);
    expect(sendVoucherEmailMock).toHaveBeenCalledWith("KSP-123", "public-token", "item-1", "buyer");
  });

  test("a voucher for the buyer gets no copy", async () => {
    const { createVoucherOnPaymentSuccess } = await import("@/lib/payment/voucher-service");
    getOrderItemsByOrderIdMock.mockResolvedValue([{ ...item, send_to: "PURCHASER" }]);
    claimVoucherDeliveriesMock.mockResolvedValue([]);

    await createVoucherOnPaymentSuccess(order);

    expect(claimVoucherDeliveriesMock).toHaveBeenCalledWith(
      expect.objectContaining({ channels: ["EMAIL", "WHATSAPP"] })
    );
    expect(listVoucherDeliveryChannelsMock).not.toHaveBeenCalled();
  });
});
