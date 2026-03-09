import { beforeEach, describe, expect, test, vi } from "vitest";

const reconcilePublicOrderStatus = vi.fn();

vi.mock("@/lib/scalev/reconcile", () => ({
  reconcilePublicOrderStatus,
}));

describe("POST /api/orders/public-status", () => {
  beforeEach(() => {
    reconcilePublicOrderStatus.mockReset();
  });

  test("returns 400 when orderId or token is missing", async () => {
    const { POST } = await import("@/app/api/orders/public-status/route");

    const response = await POST(
      new Request("http://localhost/api/orders/public-status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId: "KSP-123" }),
      }) as never
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "orderId and token are required",
    });
  });

  test("returns payload for valid requests", async () => {
    reconcilePublicOrderStatus.mockResolvedValue({
      status: "pending",
      orderId: "KSP-123",
      paymentStatus: "PENDING",
    });

    const { POST } = await import("@/app/api/orders/public-status/route");

    const response = await POST(
      new Request("http://localhost/api/orders/public-status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId: "KSP-123", token: "public-token" }),
      }) as never
    );

    expect(response.status).toBe(200);
    expect(reconcilePublicOrderStatus).toHaveBeenCalledWith(
      "KSP-123",
      "public-token"
    );
    await expect(response.json()).resolves.toEqual({
      status: "pending",
      orderId: "KSP-123",
      paymentStatus: "PENDING",
    });
  });
});
