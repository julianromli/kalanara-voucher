import { beforeEach, describe, expect, test, vi } from "vitest";
import { DeliveryMethod, SendTo } from "@/lib/types";

const mocks = vi.hoisted(() => ({
  createPendingOrder: vi.fn(),
  createPendingOrderItems: vi.fn(),
  markOrderFailed: vi.fn(),
  transitionOrderPaymentState: vi.fn(),
  validateDiscount: vi.fn(),
  reserveDiscount: vi.fn(),
  voidDiscount: vi.fn(),
  getServiceById: vi.fn(),
  getAvailability: vi.fn(),
  ensureMapping: vi.fn(),
  createScalevOrder: vi.fn(),
  createPaymentIntent: vi.fn(),
  createStatusSession: vi.fn(),
}));

vi.mock("@/lib/payment/order-writes", () => ({
  createPendingOrderForCheckout: mocks.createPendingOrder,
  createPendingOrderItemsForOrder: mocks.createPendingOrderItems,
  markOrderFailedFromGateway: mocks.markOrderFailed,
}));

vi.mock("@/lib/payment/payment-state", () => ({
  transitionOrderPaymentState: mocks.transitionOrderPaymentState,
}));

vi.mock("@/lib/discounts/service", () => ({
  normalizeCustomerPhone: (phone: string) =>
    phone.replace(/\D/g, "").replace(/^0/, "62"),
  validateDiscountForCheckout: mocks.validateDiscount,
  createPendingDiscountRedemption: mocks.reserveDiscount,
  markDiscountRedemptionVoid: mocks.voidDiscount,
}));

vi.mock("@/lib/actions/services", () => ({
  getServiceById: mocks.getServiceById,
}));

vi.mock("@/lib/scalev/client", () => ({
  getScalevCheckoutAvailability: mocks.getAvailability,
  createScalevOrder: mocks.createScalevOrder,
  createScalevPaymentIntent: mocks.createPaymentIntent,
}));

vi.mock("@/lib/scalev/catalog-sync", () => ({
  ensureScalevServiceMapping: mocks.ensureMapping,
}));

vi.mock("@/lib/scalev/config", () => ({
  getScalevConfig: () => ({ storeUniqueId: "store-123" }),
}));

vi.mock("@/lib/payment/order-status-sessions", () => ({
  createOrderStatusSession: mocks.createStatusSession,
}));

const validCheckout = {
  serviceId: "service-1",
  customerName: "Faiz",
  customerEmail: "faiz@example.com",
  customerPhone: "0812 3456-7890",
  recipientName: "Penerima",
  recipientPhone: "081234567890",
  deliveryMethod: DeliveryMethod.WHATSAPP,
  sendTo: SendTo.RECIPIENT,
  paymentMethod: "qris",
};

const discountQuote = {
  discountCodeId: "discount-1",
  code: "HEMAT10",
  discountType: "PERCENTAGE",
  discountValue: 10,
  subtotalAmount: 450000,
  discountAmount: 45000,
  totalAmount: 405000,
};

describe("createScalevCheckout", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getAvailability.mockResolvedValue({
      paymentMethods: ["qris", "va"],
      subPaymentMethods: ["BCA"],
    });
    mocks.getServiceById.mockResolvedValue({
      id: "service-1",
      name: "Balinese Massage",
      price: 450000,
      is_active: true,
    });
    mocks.ensureMapping.mockResolvedValue({
      primaryVariant: { unique_id: "variant-1" },
    });
    mocks.createPendingOrder.mockResolvedValue({
      id: "order-1",
      payment_order_id: "KSP-123",
    });
    mocks.createPendingOrderItems.mockImplementation(
      async (_orderId: string, items: unknown[]) => items
    );
    mocks.reserveDiscount.mockResolvedValue({
      success: true,
      redemptionId: "redemption-1",
    });
    mocks.createScalevOrder.mockResolvedValue({
      id: "scalev-pk-1",
      order_id: "scalev-1",
      payment_method: "qris",
      sub_payment_method: null,
      payment_status: "pending",
      status: "pending",
      pg_reference_id: "pg-1",
      secret_slug: "safe-secret",
      invoice_url: null,
      payment_link: null,
    });
    mocks.createPaymentIntent.mockResolvedValue({
      payment_url: null,
      invoice_url: null,
      reference_id: "pg-1",
    });
    mocks.transitionOrderPaymentState.mockResolvedValue({
      accepted: true,
    });
    mocks.createStatusSession.mockResolvedValue({
      id: "status-session-1",
      rawToken: "secret",
    });
    mocks.markOrderFailed.mockResolvedValue(true);
    mocks.voidDiscount.mockResolvedValue(true);
  });

  test("validates delivery targets before performing checkout work", async () => {
    const { createScalevCheckout } = await import(
      "@/lib/payment/checkout-service"
    );

    const result = await createScalevCheckout({
      ...validCheckout,
      recipientPhone: undefined,
    });

    expect(result).toEqual({
      success: false,
      status: 400,
      body: {
        success: false,
        error: "Data checkout tidak valid.",
        errorCode: "INVALID_CHECKOUT_DATA",
      },
    });
    expect(mocks.getAvailability).not.toHaveBeenCalled();
  });

  test("accepts purchaser WhatsApp without recipient phone and persists null", async () => {
    const { createScalevCheckout } = await import(
      "@/lib/payment/checkout-service"
    );

    const result = await createScalevCheckout({
      ...validCheckout,
      recipientPhone: undefined,
      sendTo: SendTo.PURCHASER,
    });

    expect(result.success).toBe(true);
    expect(mocks.createPendingOrder).toHaveBeenCalledWith(
      expect.objectContaining({
        recipient_phone: null,
        recipient_email: null,
        customer_phone: "6281234567890",
      })
    );
    expect(mocks.createPendingOrderItems).toHaveBeenCalledWith("order-1", [
      expect.objectContaining({
        recipient_phone: null,
        send_to: SendTo.PURCHASER,
      }),
    ]);
  });

  test("rejects a stale provider payment method before loading services", async () => {
    const { createScalevCheckout } = await import(
      "@/lib/payment/checkout-service"
    );
    mocks.getAvailability.mockResolvedValue({
      paymentMethods: ["va"],
      subPaymentMethods: ["BCA"],
    });

    const result = await createScalevCheckout(validCheckout);

    expect(result).toEqual({
      success: false,
      status: 400,
      body: {
        success: false,
        error: "Metode pembayaran tidak tersedia.",
        errorCode: "PAYMENT_METHOD_UNAVAILABLE",
      },
    });
    expect(mocks.getAvailability).toHaveBeenCalledOnce();
    expect(mocks.getServiceById).not.toHaveBeenCalled();
    expect(mocks.createPendingOrder).not.toHaveBeenCalled();
    expect(mocks.createScalevOrder).not.toHaveBeenCalled();
  });

  test("maps the catalog before persisting and reuses loaded services for pricing", async () => {
    const { createScalevCheckout } = await import(
      "@/lib/payment/checkout-service"
    );

    const result = await createScalevCheckout(validCheckout);

    expect(result.success).toBe(true);
    expect(mocks.ensureMapping.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.createPendingOrder.mock.invocationCallOrder[0]
    );
    expect(mocks.getServiceById).toHaveBeenCalledOnce();
    expect(mocks.createPendingOrder).toHaveBeenCalledWith(
      expect.objectContaining({
        customer_phone: "6281234567890",
        subtotal_amount: 450000,
        total_amount: 450000,
      })
    );
    expect(mocks.createScalevOrder).toHaveBeenCalledWith(
      expect.objectContaining({
        store_unique_id: "store-123",
        ordervariants: [{ variant_unique_id: "variant-1", quantity: 1 }],
        metadata: expect.objectContaining({
          local_order_id: "order-1",
          payment_order_id: "KSP-123",
          subtotal_amount: 450000,
          total_amount: 450000,
        }),
      })
    );
  });

  test("creates every cart order item and maps every Scalev variant", async () => {
    const { createScalevCheckout } = await import(
      "@/lib/payment/checkout-service"
    );
    mocks.getServiceById.mockImplementation(async (id: string) => ({
      id,
      name: `Service ${id}`,
      price: id === "service-1" ? 450000 : 250000,
      is_active: true,
    }));
    mocks.ensureMapping.mockImplementation(
      async (service: { id: string }) => ({
        primaryVariant: { unique_id: `variant-${service.id}` },
      })
    );

    const result = await createScalevCheckout({
      customerName: "Faiz",
      customerEmail: "faiz@example.com",
      customerPhone: "081234567890",
      paymentMethod: "qris",
      lineItems: [
        {
          serviceId: "service-1",
          recipientName: "A",
          recipientPhone: "081234567890",
          deliveryMethod: DeliveryMethod.WHATSAPP,
          sendTo: SendTo.RECIPIENT,
        },
        {
          serviceId: "service-2",
          recipientName: "B",
          recipientEmail: "b@example.com",
          deliveryMethod: DeliveryMethod.EMAIL,
          sendTo: SendTo.RECIPIENT,
        },
      ],
    });

    expect(result.success).toBe(true);
    expect(mocks.createPendingOrder).toHaveBeenCalledWith(
      expect.objectContaining({
        service_id: null,
        subtotal_amount: 700000,
        total_amount: 700000,
      })
    );
    expect(mocks.createPendingOrderItems).toHaveBeenCalledWith("order-1", [
      expect.objectContaining({ service_id: "service-1", sort_order: 0 }),
      expect.objectContaining({ service_id: "service-2", sort_order: 1 }),
    ]);
    expect(mocks.createScalevOrder).toHaveBeenCalledWith(
      expect.objectContaining({
        ordervariants: [
          { variant_unique_id: "variant-service-1", quantity: 1 },
          { variant_unique_id: "variant-service-2", quantity: 1 },
        ],
        metadata: expect.objectContaining({ item_count: 2 }),
      })
    );
  });

  test("rejects external provider URLs and never persists them", async () => {
    const { createScalevCheckout } = await import(
      "@/lib/payment/checkout-service"
    );
    mocks.createPaymentIntent.mockResolvedValue({
      payment_url: "https://app.scalev.id.evil.test/pay",
      invoice_url: "https://example.com/invoice",
      reference_id: "pg-1",
    });
    mocks.createScalevOrder.mockResolvedValue({
      id: "scalev-pk-1",
      order_id: "scalev-1",
      payment_method: "qris",
      payment_link: "https://lookalike-scalev.id/pay",
      secret_slug: "safe-secret",
    });

    const result = await createScalevCheckout(validCheckout);

    expect(result).toEqual(
      expect.objectContaining({
        success: true,
        body: expect.objectContaining({
          paymentLink: "https://app.scalev.id/order/public/safe-secret",
        }),
      })
    );
    expect(mocks.transitionOrderPaymentState).toHaveBeenCalledWith(
      expect.objectContaining({
        gatewayUpdate: expect.objectContaining({
          paymentLink: "https://app.scalev.id/order/public/safe-secret",
        }),
      })
    );
    expect(
      JSON.stringify(mocks.transitionOrderPaymentState.mock.calls)
    ).not.toContain("evil.test");
    expect(
      JSON.stringify(mocks.transitionOrderPaymentState.mock.calls)
    ).not.toContain("lookalike-scalev.id");
  });

  test("persists discounted snapshots and forwards productDiscount", async () => {
    const { createScalevCheckout } = await import(
      "@/lib/payment/checkout-service"
    );
    mocks.validateDiscount.mockResolvedValue({
      valid: true,
      quote: discountQuote,
    });

    const result = await createScalevCheckout({
      ...validCheckout,
      discountCode: "HEMAT10",
    });

    expect(result.success).toBe(true);
    expect(mocks.createPendingOrder).toHaveBeenCalledWith(
      expect.objectContaining({
        subtotal_amount: 450000,
        discount_code_id: "discount-1",
        discount_code: "HEMAT10",
        discount_type_snapshot: "PERCENTAGE",
        discount_value_snapshot: 10,
        discount_amount: 45000,
        total_amount: 405000,
      })
    );
    expect(mocks.reserveDiscount).toHaveBeenCalledWith(
      expect.objectContaining({
        discountCodeId: "discount-1",
        discountAmount: 45000,
        totalAmount: 405000,
      })
    );
    expect(mocks.createScalevOrder).toHaveBeenCalledWith(
      expect.objectContaining({
        productDiscount: 45000,
        metadata: expect.objectContaining({
          discount_code: "HEMAT10",
          discount_amount: 45000,
          total_amount: 405000,
        }),
      })
    );
  });

  test("rejects an invalid discount before creating a local order", async () => {
    const { createScalevCheckout } = await import(
      "@/lib/payment/checkout-service"
    );
    mocks.validateDiscount.mockResolvedValue({
      valid: false,
      reason: "INVALID",
      message: "Kode diskon tidak ditemukan.",
    });

    const result = await createScalevCheckout({
      ...validCheckout,
      discountCode: "SALAH",
    });

    expect(result).toEqual({
      success: false,
      status: 400,
      body: {
        success: false,
        error: "Kode diskon tidak ditemukan.",
        errorCode: "DISCOUNT_CODE_INVALID",
      },
    });
    expect(mocks.validateDiscount).toHaveBeenCalledWith(
      expect.objectContaining({
        discountCode: "SALAH",
        subtotalAmount: 450000,
      })
    );
    expect(mocks.ensureMapping).not.toHaveBeenCalled();
    expect(mocks.createPendingOrder).not.toHaveBeenCalled();
  });

  test("marks the order failed then voids its reservation at one failure boundary", async () => {
    const { createScalevCheckout } = await import(
      "@/lib/payment/checkout-service"
    );
    mocks.validateDiscount.mockResolvedValue({
      valid: true,
      quote: discountQuote,
    });
    mocks.createPendingOrderItems.mockResolvedValue([]);

    const result = await createScalevCheckout({
      ...validCheckout,
      discountCode: "HEMAT10",
    });

    expect(result).toEqual({
      success: false,
      status: 500,
      body: {
        success: false,
        error: "Pesanan belum bisa dibuat. Silakan coba lagi.",
        errorCode: "LOCAL_ORDER_FAILED",
      },
    });
    expect(mocks.markOrderFailed).toHaveBeenCalledOnce();
    expect(mocks.markOrderFailed).toHaveBeenCalledWith(
      "order-1",
      expect.objectContaining({
        paymentProvider: "scalev",
        scalevPaymentMethod: "qris",
        scalevStoreUniqueId: "store-123",
      })
    );
    expect(mocks.voidDiscount).toHaveBeenCalledOnce();
    expect(mocks.markOrderFailed.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.voidDiscount.mock.invocationCallOrder[0]
    );
    expect(mocks.createScalevOrder).not.toHaveBeenCalled();
  });

  test("does not void a discount reservation that was never acquired", async () => {
    const { createScalevCheckout } = await import(
      "@/lib/payment/checkout-service"
    );
    mocks.validateDiscount.mockResolvedValue({
      valid: true,
      quote: discountQuote,
    });
    mocks.reserveDiscount.mockResolvedValue({
      success: false,
      reason: "GLOBAL_LIMIT_REACHED",
      message: "Kuota kode diskon sudah habis.",
    });

    const result = await createScalevCheckout({
      ...validCheckout,
      discountCode: "HEMAT10",
    });

    expect(result).toEqual({
      success: false,
      status: 400,
      body: {
        success: false,
        error: "Kuota kode diskon sudah habis.",
        errorCode: "DISCOUNT_CODE_INVALID",
      },
    });
    expect(mocks.markOrderFailed).toHaveBeenCalledOnce();
    expect(mocks.voidDiscount).not.toHaveBeenCalled();
    expect(mocks.createPendingOrderItems).not.toHaveBeenCalled();
  });

  test("preserves gateway metadata when persistence rejects the transition", async () => {
    const { createScalevCheckout } = await import(
      "@/lib/payment/checkout-service"
    );
    mocks.transitionOrderPaymentState.mockResolvedValue({
      accepted: false,
      reason: "database_error",
    });

    const result = await createScalevCheckout(validCheckout);

    expect(result).toEqual({
      success: false,
      status: 500,
      body: {
        success: false,
        error: "Pesanan belum bisa disiapkan sepenuhnya. Silakan coba lagi.",
        errorCode: "LOCAL_ORDER_FAILED",
      },
    });
    expect(mocks.markOrderFailed).toHaveBeenCalledWith(
      "order-1",
      expect.objectContaining({
        paymentProvider: "scalev",
        transactionId: "pg-1",
        scalevOrderPk: "scalev-pk-1",
        scalevOrderId: "scalev-1",
        scalevPgReferenceId: "pg-1",
        scalevRawStatus: "pending",
        scalevRawPaymentStatus: "pending",
      })
    );
  });

  test("voids a reserved discount when Scalev rejects the payment", async () => {
    const { createScalevCheckout } = await import(
      "@/lib/payment/checkout-service"
    );
    mocks.validateDiscount.mockResolvedValue({
      valid: true,
      quote: discountQuote,
    });
    mocks.createScalevOrder.mockRejectedValue(new Error("discount rejected"));

    const result = await createScalevCheckout({
      ...validCheckout,
      discountCode: "HEMAT10",
    });

    expect(result).toEqual({
      success: false,
      status: 502,
      body: {
        success: false,
        error:
          "Pembayaran dengan kode diskon belum bisa diproses saat ini. Silakan coba lagi.",
        errorCode: "DISCOUNT_GATEWAY_REJECTED",
      },
    });
    expect(mocks.markOrderFailed).toHaveBeenCalledOnce();
    expect(mocks.voidDiscount).toHaveBeenCalledWith("order-1");
  });

  test("fails before local persistence when catalog mapping fails", async () => {
    const { createScalevCheckout } = await import(
      "@/lib/payment/checkout-service"
    );
    mocks.ensureMapping.mockRejectedValue(new Error("catalog unavailable"));

    const result = await createScalevCheckout(validCheckout);

    expect(result).toEqual({
      success: false,
      status: 502,
      body: {
        success: false,
        error:
          "Gagal menyiapkan layanan untuk pembayaran. Silakan coba lagi.",
        errorCode: "SCALEV_PAYMENT_FAILED",
      },
    });
    expect(mocks.createPendingOrder).not.toHaveBeenCalled();
    expect(mocks.markOrderFailed).not.toHaveBeenCalled();
  });

  test("keeps the payment-link response when order cleanup rejects", async () => {
    const { createScalevCheckout } = await import(
      "@/lib/payment/checkout-service"
    );
    mocks.createScalevOrder.mockResolvedValue({
      id: "scalev-pk-1",
      order_id: "scalev-1",
      payment_method: "qris",
      sub_payment_method: null,
      payment_status: "pending",
      status: "pending",
      pg_reference_id: "pg-1",
      secret_slug: null,
      invoice_url: null,
      payment_link: null,
    });
    mocks.markOrderFailed.mockRejectedValue(new Error("database unavailable"));

    const result = await createScalevCheckout(validCheckout);

    expect(result).toEqual({
      success: false,
      status: 502,
      body: {
        success: false,
        error:
          "Payment link dari Scalev belum tersedia. Silakan coba beberapa saat lagi.",
        errorCode: "PAYMENT_LINK_MISSING",
      },
    });
    expect(mocks.markOrderFailed).toHaveBeenCalledOnce();
  });
});
