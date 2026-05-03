import { beforeEach, describe, expect, test, vi } from "vitest";
import { DeliveryMethod, SendTo } from "@/lib/types";

const {
  createPendingOrderMock,
  createPendingOrderItemsMock,
  updateOrderGatewayDataMock,
  markOrderFailedFromGatewayMock,
  getServiceByIdMock,
  getScalevCheckoutAvailabilityMock,
  ensureScalevServiceMappingMock,
  createScalevOrderMock,
  createScalevPaymentIntentMock,
} = vi.hoisted(() => ({
  createPendingOrderMock: vi.fn(),
  createPendingOrderItemsMock: vi.fn(),
  updateOrderGatewayDataMock: vi.fn(),
  markOrderFailedFromGatewayMock: vi.fn(),
  getServiceByIdMock: vi.fn(),
  getScalevCheckoutAvailabilityMock: vi.fn(),
  ensureScalevServiceMappingMock: vi.fn(),
  createScalevOrderMock: vi.fn(),
  createScalevPaymentIntentMock: vi.fn(),
}));

vi.mock("@/lib/actions/orders", () => ({
  createPendingOrder: createPendingOrderMock,
  createPendingOrderItems: createPendingOrderItemsMock,
  updateOrderGatewayData: updateOrderGatewayDataMock,
  markOrderFailedFromGateway: markOrderFailedFromGatewayMock,
}));

vi.mock("@/lib/actions/services", () => ({
  getServiceById: getServiceByIdMock,
}));

vi.mock("@/lib/scalev/client", () => ({
  getScalevCheckoutAvailability: getScalevCheckoutAvailabilityMock,
  createScalevOrder: createScalevOrderMock,
  createScalevPaymentIntent: createScalevPaymentIntentMock,
}));

vi.mock("@/lib/scalev/catalog-sync", () => ({
  ensureScalevServiceMapping: ensureScalevServiceMappingMock,
}));

vi.mock("@/lib/scalev/config", () => ({
  getScalevConfig: () => ({
    storeUniqueId: "store-123",
  }),
}));

describe("POST /api/scalev/create-payment", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    getServiceByIdMock.mockResolvedValue({
      id: "service-1",
      name: "Balinese Massage",
      price: 450000,
      is_active: true,
    });
    getScalevCheckoutAvailabilityMock.mockResolvedValue({
      paymentMethods: ["qris", "va"],
      subPaymentMethods: ["BCA"],
    });
    ensureScalevServiceMappingMock.mockResolvedValue({
      primaryVariant: { unique_id: "variant-1" },
    });
    createPendingOrderMock.mockResolvedValue({
      id: "order-1",
      payment_order_id: "KSP-123",
      public_access_token: "public-token",
    });
    createPendingOrderItemsMock.mockImplementation(async (items: unknown[]) => items);
    createScalevOrderMock.mockResolvedValue({
      id: 99,
      order_id: "scalev-1",
      payment_method: "qris",
      sub_payment_method: null,
      payment_status: "pending",
      status: "pending",
      pg_reference_id: "pg-1",
      secret_slug: "secret-token",
      invoice_url: null,
      payment_link: null,
    });
    createScalevPaymentIntentMock.mockResolvedValue({
      payment_url: null,
      invoice_url: null,
      reference_id: "pg-1",
    });
    updateOrderGatewayDataMock.mockResolvedValue(true);
    markOrderFailedFromGatewayMock.mockResolvedValue(true);
  });

  test("allows purchaser WhatsApp checkout without recipient phone and stores null", async () => {
    const { POST } = await import("@/app/api/scalev/create-payment/route");

    const response = await POST(
      new Request("http://localhost/api/scalev/create-payment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          serviceId: "service-1",
          customerName: "Faiz",
          customerEmail: "faiz@example.com",
          customerPhone: "0812 3456-7890",
          recipientName: "Penerima",
          deliveryMethod: DeliveryMethod.WHATSAPP,
          sendTo: SendTo.PURCHASER,
          paymentMethod: "qris",
        }),
      }) as never
    );

    expect(response.status).toBe(200);
    expect(createPendingOrderMock).toHaveBeenCalledWith(
      expect.objectContaining({
        recipient_phone: null,
        recipient_email: null,
        customer_phone: "6281234567890",
      })
    );
  });

  test("rejects recipient email delivery when recipient email is missing", async () => {
    const { POST } = await import("@/app/api/scalev/create-payment/route");

    const response = await POST(
      new Request("http://localhost/api/scalev/create-payment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          serviceId: "service-1",
          customerName: "Faiz",
          customerEmail: "faiz@example.com",
          customerPhone: "081234567890",
          recipientName: "Penerima",
          deliveryMethod: DeliveryMethod.EMAIL,
          sendTo: SendTo.RECIPIENT,
          paymentMethod: "qris",
        }),
      }) as never
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      success: false,
      error: "Data checkout tidak valid.",
      errorCode: "INVALID_CHECKOUT_DATA",
    });
    expect(createPendingOrderMock).not.toHaveBeenCalled();
  });

  test("creates order items for cart checkout", async () => {
    const { POST } = await import("@/app/api/scalev/create-payment/route");

    getServiceByIdMock.mockImplementation(async (id: string) => ({
      id,
      name: `Service ${id}`,
      price: id === "service-1" ? 450000 : 250000,
      is_active: true,
    }));
    ensureScalevServiceMappingMock.mockImplementation(async (service: { id: string }) => ({
      primaryVariant: { unique_id: `variant-${service.id}` },
    }));
    const response = await POST(
      new Request("http://localhost/api/scalev/create-payment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
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
          customerName: "Faiz",
          customerEmail: "faiz@example.com",
          customerPhone: "081234567890",
          paymentMethod: "qris",
        }),
      }) as never
    );

    expect(response.status).toBe(200);
    expect(createPendingOrderMock).toHaveBeenCalledWith(
      expect.objectContaining({
        service_id: null,
        total_amount: 700000,
      })
    );
    expect(createPendingOrderItemsMock).toHaveBeenCalledWith([
      expect.objectContaining({
        order_id: "order-1",
        service_id: "service-1",
        unit_price: 450000,
      }),
      expect.objectContaining({
        order_id: "order-1",
        service_id: "service-2",
        unit_price: 250000,
      }),
    ]);
    expect(createScalevOrderMock).toHaveBeenCalledWith(
      expect.objectContaining({
        ordervariants: [
          { variant_unique_id: "variant-service-1", quantity: 1 },
          { variant_unique_id: "variant-service-2", quantity: 1 },
        ],
      })
    );
  });

  test("fails when gateway metadata cannot be persisted locally", async () => {
    const { POST } = await import("@/app/api/scalev/create-payment/route");

    updateOrderGatewayDataMock.mockResolvedValue(false);

    const response = await POST(
      new Request("http://localhost/api/scalev/create-payment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          serviceId: "service-1",
          customerName: "Faiz",
          customerEmail: "faiz@example.com",
          customerPhone: "081234567890",
          recipientName: "Penerima",
          recipientPhone: "081234567890",
          deliveryMethod: DeliveryMethod.WHATSAPP,
          sendTo: SendTo.RECIPIENT,
          paymentMethod: "qris",
        }),
      }) as never
    );

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      success: false,
      error: "Pesanan belum bisa disiapkan sepenuhnya. Silakan coba lagi.",
      errorCode: "LOCAL_ORDER_FAILED",
    });
    expect(markOrderFailedFromGatewayMock).toHaveBeenCalledWith(
      "order-1",
      expect.objectContaining({
        paymentProvider: "scalev",
        scalevOrderPk: 99,
        scalevPgReferenceId: "pg-1",
      })
    );
  });
});
