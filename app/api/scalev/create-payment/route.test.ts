import { beforeEach, describe, expect, test, vi } from "vitest";

const {
  createScalevCheckoutMock,
  scheduleExpiredOrderStatusSessionCleanupMock,
} = vi.hoisted(() => ({
  createScalevCheckoutMock: vi.fn(),
  scheduleExpiredOrderStatusSessionCleanupMock: vi.fn(),
}));

vi.mock("@/lib/payment/checkout-service", () => ({
  createScalevCheckout: createScalevCheckoutMock,
}));

vi.mock("@/lib/payment/order-status-sessions", () => ({
  getOrderStatusCookieName: (sessionId: string) =>
    `__Host-kalanara-status-${sessionId}`,
  ORDER_STATUS_SESSION_TTL_SECONDS: 30 * 60,
  scheduleExpiredOrderStatusSessionCleanup:
    scheduleExpiredOrderStatusSessionCleanupMock,
}));

describe("POST /api/scalev/create-payment", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("passes parsed request data to the checkout service", async () => {
    const { POST } = await import("@/app/api/scalev/create-payment/route");
    createScalevCheckoutMock.mockResolvedValue({
      success: false,
      status: 400,
      body: {
        success: false,
        error: "Data checkout tidak valid.",
        errorCode: "INVALID_CHECKOUT_DATA",
      },
    });

    const response = await POST(
      new Request("http://localhost/api/scalev/create-payment", {
        method: "POST",
        body: JSON.stringify({ customerName: "Faiz" }),
      }) as never
    );

    expect(createScalevCheckoutMock).toHaveBeenCalledWith({
      customerName: "Faiz",
    });
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      success: false,
      error: "Data checkout tidak valid.",
      errorCode: "INVALID_CHECKOUT_DATA",
    });
  });

  test("passes null to the service when JSON parsing fails", async () => {
    const { POST } = await import("@/app/api/scalev/create-payment/route");
    createScalevCheckoutMock.mockResolvedValue({
      success: false,
      status: 400,
      body: {
        success: false,
        error: "Data checkout tidak valid.",
        errorCode: "INVALID_CHECKOUT_DATA",
      },
    });

    await POST(
      new Request("http://localhost/api/scalev/create-payment", {
        method: "POST",
        body: "{",
      }) as never
    );

    expect(createScalevCheckoutMock).toHaveBeenCalledWith(null);
  });

  test("sets the private status cookie and no-store response on success", async () => {
    const { POST } = await import("@/app/api/scalev/create-payment/route");
    createScalevCheckoutMock.mockResolvedValue({
      success: true,
      body: {
        success: true,
        paymentLink: "https://app.scalev.id/order/public/safe-secret",
        orderId: "scalev-1",
        paymentOrderId: "KSP-123",
        statusSessionId: "status-session-1",
        paymentMethod: "qris",
      },
      statusSession: {
        id: "status-session-1",
        rawToken: "short-lived-secret",
      },
    });

    const response = await POST(
      new Request("https://voucher.kalanaraspa.com/api/scalev/create-payment", {
        method: "POST",
        body: "{}",
      }) as never
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(await response.json()).not.toHaveProperty("rawToken");
    const cookie = response.headers.get("set-cookie");
    expect(cookie).toContain(
      "__Host-kalanara-status-status-session-1=short-lived-secret"
    );
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("Secure");
    expect(cookie).toContain("SameSite=lax");
    expect(cookie).toContain("Path=/");
    expect(cookie).toContain("Max-Age=1800");
    expect(scheduleExpiredOrderStatusSessionCleanupMock).toHaveBeenCalledOnce();
  });
});
