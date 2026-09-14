import { createHash } from "node:crypto";
import { beforeEach, describe, expect, test, vi } from "vitest";

const {
  deleteLte,
  insertSingle,
  insertQuery,
  resolveSingle,
  resolveGt,
  resolveEqPaymentOrder,
  resolveEqHash,
  resolveEqSession,
  from,
} = vi.hoisted(() => {
  const deleteLte = vi.fn();
  const deleteQuery = vi.fn(() => ({ lte: deleteLte }));
  const insertSingle = vi.fn();
  const insertSelect = vi.fn(() => ({ single: insertSingle }));
  const insertQuery = vi.fn(() => ({ select: insertSelect }));
  const resolveSingle = vi.fn();
  const resolveGt = vi.fn(() => ({ single: resolveSingle }));
  const resolveEqPaymentOrder = vi.fn(() => ({ gt: resolveGt }));
  const resolveEqHash = vi.fn(() => ({ eq: resolveEqPaymentOrder }));
  const resolveEqSession = vi.fn(() => ({ eq: resolveEqHash }));
  const resolveSelect = vi.fn(() => ({ eq: resolveEqSession }));
  const from = vi.fn(() => ({
    delete: deleteQuery,
    insert: insertQuery,
    select: resolveSelect,
  }));

  return {
    deleteLte,
    insertSingle,
    insertQuery,
    resolveSingle,
    resolveGt,
    resolveEqPaymentOrder,
    resolveEqHash,
    resolveEqSession,
    from,
  };
});

vi.mock("@/lib/supabase/admin", () => ({
  getAdminClient: () => ({ from }),
}));

describe("order status sessions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    deleteLte.mockResolvedValue({ error: null });
    insertSingle.mockResolvedValue({
      data: { id: "status-session-1" },
      error: null,
    });
    resolveSingle.mockResolvedValue({
      data: {
        id: "status-session-1",
        order_id: "order-1",
        expires_at: "2026-09-14T12:58:00.000Z",
      },
      error: null,
    });
  });

  test("stores only a SHA-256 hash and cleans expired sessions", async () => {
    const { createOrderStatusSession } = await import(
      "@/lib/payment/order-status-sessions"
    );

    const result = await createOrderStatusSession({
      orderId: "order-1",
      rawToken: "deterministic-test-secret",
      now: new Date("2026-09-14T12:28:00.000Z"),
    });

    expect(deleteLte).toHaveBeenCalledWith(
      "expires_at",
      "2026-09-14T12:28:00.000Z"
    );
    expect(insertQuery).toHaveBeenCalledWith({
      order_id: "order-1",
      token_hash: createHash("sha256")
        .update("deterministic-test-secret")
        .digest("hex"),
      expires_at: "2026-09-14T12:58:00.000Z",
    });
    expect(JSON.stringify(insertQuery.mock.calls)).not.toContain(
      "deterministic-test-secret"
    );
    expect(result).toEqual({
      id: "status-session-1",
      rawToken: "deterministic-test-secret",
    });
  });

  test("binds resolution to session, hash, payment order, and expiry", async () => {
    const { resolveActiveOrderStatusSession } = await import(
      "@/lib/payment/order-status-sessions"
    );

    const result = await resolveActiveOrderStatusSession({
      sessionId: "status-session-1",
      paymentOrderId: "KSP-123",
      rawToken: "short-lived-secret",
      now: new Date("2026-09-14T12:28:00.000Z"),
    });

    expect(resolveEqSession).toHaveBeenCalledWith("id", "status-session-1");
    expect(resolveEqHash).toHaveBeenCalledWith(
      "token_hash",
      createHash("sha256").update("short-lived-secret").digest("hex")
    );
    expect(resolveEqPaymentOrder).toHaveBeenCalledWith(
      "orders.payment_order_id",
      "KSP-123"
    );
    expect(resolveGt).toHaveBeenCalledWith(
      "expires_at",
      "2026-09-14T12:28:00.000Z"
    );
    expect(result).toEqual({
      id: "status-session-1",
      orderId: "order-1",
      expiresAt: "2026-09-14T12:58:00.000Z",
    });
  });

  test("returns null for an expired, modified, or cross-order session", async () => {
    resolveSingle.mockResolvedValue({
      data: null,
      error: { code: "PGRST116", message: "No rows" },
    });
    const { resolveActiveOrderStatusSession } = await import(
      "@/lib/payment/order-status-sessions"
    );

    await expect(
      resolveActiveOrderStatusSession({
        sessionId: "status-session-1",
        paymentOrderId: "KSP-other",
        rawToken: "modified-secret",
      })
    ).resolves.toBeNull();
  });
});
