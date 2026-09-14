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
  getAdminClient,
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
  const getAdminClient = vi.fn(() => ({ from }));

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
    getAdminClient,
  };
});

vi.mock("@/lib/supabase/admin", () => ({
  getAdminClient,
}));

describe("order status sessions", () => {
  const sessionId = "123e4567-e89b-42d3-a456-426614174000";

  beforeEach(() => {
    vi.clearAllMocks();
    deleteLte.mockResolvedValue({ error: null });
    insertSingle.mockResolvedValue({
      data: { id: sessionId },
      error: null,
    });
    resolveSingle.mockResolvedValue({
      data: {
        id: sessionId,
        order_id: "order-1",
        expires_at: "2026-09-14T12:58:00.000Z",
      },
      error: null,
    });
  });

  test("stores only a SHA-256 hash without coupling global cleanup to checkout", async () => {
    const { createOrderStatusSession } = await import(
      "@/lib/payment/order-status-sessions"
    );

    const result = await createOrderStatusSession({
      orderId: "order-1",
      rawToken: "deterministic-test-secret",
      now: new Date("2026-09-14T12:28:00.000Z"),
    });

    expect(deleteLte).not.toHaveBeenCalled();
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
      id: sessionId,
      rawToken: "deterministic-test-secret",
    });
  });

  test("binds resolution to session, hash, payment order, and expiry", async () => {
    const { resolveActiveOrderStatusSession } = await import(
      "@/lib/payment/order-status-sessions"
    );

    const result = await resolveActiveOrderStatusSession({
      sessionId,
      paymentOrderId: "KSP-123",
      rawToken: "short-lived-secret",
      now: new Date("2026-09-14T12:28:00.000Z"),
    });

    expect(resolveEqSession).toHaveBeenCalledWith("id", sessionId);
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
      id: sessionId,
      orderId: "order-1",
      expiresAt: "2026-09-14T12:58:00.000Z",
    });
  });

  test("returns null when the resolver finds no row matching hash, expiry, and order", async () => {
    resolveSingle.mockResolvedValue({
      data: null,
      error: { code: "PGRST116", message: "No rows" },
    });
    const { resolveActiveOrderStatusSession } = await import(
      "@/lib/payment/order-status-sessions"
    );

    await expect(
      resolveActiveOrderStatusSession({
        sessionId,
        paymentOrderId: "KSP-other",
        rawToken: "modified-secret",
      })
    ).resolves.toBeNull();
  });

  test("rejects a malformed UUID before creating an admin client or query", async () => {
    const { resolveActiveOrderStatusSession } = await import(
      "@/lib/payment/order-status-sessions"
    );
    getAdminClient.mockClear();
    from.mockClear();

    await expect(
      resolveActiveOrderStatusSession({
        sessionId: "not-a-uuid",
        paymentOrderId: "KSP-123",
        rawToken: "secret",
      })
    ).resolves.toBeNull();

    expect(getAdminClient).not.toHaveBeenCalled();
    expect(from).not.toHaveBeenCalled();
  });
});
