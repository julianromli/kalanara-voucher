import { beforeEach, describe, expect, test, vi } from "vitest";
import { DeliveryMethod, SendTo } from "@/lib/types";

const {
  createPendingOrderMock,
  updateOrderGatewayDataMock,
  markOrderFailedFromGatewayMock,
  getServiceByIdMock,
  getScalevCheckoutAvailabilityMock,
  ensureScalevServiceMappingMock,
  createScalevOrderMock,
  createScalevPaymentIntentMock,
} = vi.hoisted(() => ({
  createPendingOrderMock: vi.fn(),
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
        recipient_email: undefined,
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
    });
    expect(createPendingOrderMock).not.toHaveBeenCalled();
  });
});
