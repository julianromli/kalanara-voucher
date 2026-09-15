import { NextRequest } from "next/server";
import { beforeEach, describe, expect, test, vi } from "vitest";

const {
  reconcilePublicOrderStatusByInternalOrderId,
  resolveActiveOrderStatusSession,
} = vi.hoisted(() => ({
  reconcilePublicOrderStatusByInternalOrderId: vi.fn(),
  resolveActiveOrderStatusSession: vi.fn(),
}));

vi.mock("@/lib/scalev/reconcile", () => ({
  reconcilePublicOrderStatusByInternalOrderId,
}));

vi.mock("@/lib/payment/order-status-sessions", () => ({
  getOrderStatusCookieName: (sessionId: string) =>
    `__Host-kalanara-status-${sessionId}`,
  isValidOrderStatusSessionId: (sessionId: string) =>
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      sessionId
    ),
  resolveActiveOrderStatusSession,
}));

describe("POST /api/orders/public-status", () => {
  const sessionId = "123e4567-e89b-42d3-a456-426614174000";

  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("returns 401 without a matching status-session cookie", async () => {
    const { POST } = await import("@/app/api/orders/public-status/route");

    const response = await POST(
      new NextRequest("https://voucher.kalanaraspa.com/api/orders/public-status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId: "KSP-123",
          statusSessionId: sessionId,
        }),
      })
    );

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      error: "Sesi status pembayaran diperlukan.",
    });
    expect(resolveActiveOrderStatusSession).not.toHaveBeenCalled();
    expect(reconcilePublicOrderStatusByInternalOrderId).not.toHaveBeenCalled();
  });

  test("rejects a malformed status session UUID before querying Postgres", async () => {
    const { POST } = await import("@/app/api/orders/public-status/route");

    const response = await POST(
      new NextRequest("https://voucher.kalanaraspa.com/api/orders/public-status", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: "__Host-kalanara-status-not-a-uuid=secret",
        },
        body: JSON.stringify({
          orderId: "KSP-123",
          statusSessionId: "not-a-uuid",
        }),
      })
    );

    expect(response.status).toBe(401);
    expect(resolveActiveOrderStatusSession).not.toHaveBeenCalled();
    expect(reconcilePublicOrderStatusByInternalOrderId).not.toHaveBeenCalled();
  });

  test("rejects a status session rejected by the resolver", async () => {
    resolveActiveOrderStatusSession.mockResolvedValue(null);
    const { POST } = await import("@/app/api/orders/public-status/route");

    const response = await POST(
      new NextRequest("https://voucher.kalanaraspa.com/api/orders/public-status", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: `__Host-kalanara-status-${sessionId}=rejected-secret`,
        },
        body: JSON.stringify({
          orderId: "KSP-123",
          statusSessionId: sessionId,
        }),
      })
    );

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      error: "Sesi status pembayaran tidak valid atau sudah kedaluwarsa.",
    });
    expect(reconcilePublicOrderStatusByInternalOrderId).not.toHaveBeenCalled();
  });

  test("returns a private no-store payload for a valid bound session", async () => {
    resolveActiveOrderStatusSession.mockResolvedValue({
      id: sessionId,
      orderId: "internal-order-1",
      expiresAt: "2026-09-14T12:58:00.000Z",
    });
    reconcilePublicOrderStatusByInternalOrderId.mockResolvedValue({
      status: "pending",
      orderId: "KSP-123",
      paymentStatus: "PENDING",
    });

    const { POST } = await import("@/app/api/orders/public-status/route");

    const response = await POST(
      new NextRequest("https://voucher.kalanaraspa.com/api/orders/public-status", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie:
            `__Host-kalanara-status-${sessionId}=short-lived-secret`,
        },
        body: JSON.stringify({
          orderId: "KSP-123",
          statusSessionId: sessionId,
        }),
      })
    );

    expect(response.status).toBe(200);
    expect(resolveActiveOrderStatusSession).toHaveBeenCalledWith({
      sessionId,
      paymentOrderId: "KSP-123",
      rawToken: "short-lived-secret",
    });
    expect(reconcilePublicOrderStatusByInternalOrderId).toHaveBeenCalledWith(
      "internal-order-1"
    );
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    await expect(response.json()).resolves.toEqual({
      status: "pending",
      orderId: "KSP-123",
      paymentStatus: "PENDING",
    });
  });
});
