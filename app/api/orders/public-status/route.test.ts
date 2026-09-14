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
  resolveActiveOrderStatusSession,
}));

describe("POST /api/orders/public-status", () => {
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
          statusSessionId: "status-session-1",
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

  test.each([
    ["modified cookie", "modified-secret"],
    ["expired cookie", "expired-secret"],
    ["cookie bound to another order", "cross-order-secret"],
  ])("rejects a %s without returning order data", async (_label, rawToken) => {
    resolveActiveOrderStatusSession.mockResolvedValue(null);
    const { POST } = await import("@/app/api/orders/public-status/route");

    const response = await POST(
      new NextRequest("https://voucher.kalanaraspa.com/api/orders/public-status", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: `__Host-kalanara-status-status-session-1=${rawToken}`,
        },
        body: JSON.stringify({
          orderId: "KSP-123",
          statusSessionId: "status-session-1",
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
      id: "status-session-1",
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
            "__Host-kalanara-status-status-session-1=short-lived-secret",
        },
        body: JSON.stringify({
          orderId: "KSP-123",
          statusSessionId: "status-session-1",
        }),
      })
    );

    expect(response.status).toBe(200);
    expect(resolveActiveOrderStatusSession).toHaveBeenCalledWith({
      sessionId: "status-session-1",
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
