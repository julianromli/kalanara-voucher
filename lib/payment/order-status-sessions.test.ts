import { createHash } from "node:crypto";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

const {
  afterMock,
  deleteLte,
  deleteQuery,
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
  const afterMock = vi.fn();
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
    afterMock,
    deleteLte,
    deleteQuery,
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

vi.mock("next/server", () => ({
  after: afterMock,
}));

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

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
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

  test("throws when the status-session insert fails", async () => {
    const insertError = { code: "23505", message: "insert failed" };
    insertSingle.mockResolvedValue({ data: null, error: insertError });
    const { createOrderStatusSession } = await import(
      "@/lib/payment/order-status-sessions"
    );

    await expect(
      createOrderStatusSession({
        orderId: "order-1",
        rawToken: "deterministic-test-secret",
      })
    ).rejects.toMatchObject({
      message: "Failed to create order status session.",
      cause: insertError,
    });
  });

  test("schedules expired-session cleanup after the response lifecycle", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-14T12:28:00.000Z"));
    const { scheduleExpiredOrderStatusSessionCleanup } = await import(
      "@/lib/payment/order-status-sessions"
    );

    scheduleExpiredOrderStatusSessionCleanup();

    expect(afterMock).toHaveBeenCalledOnce();
    expect(afterMock).toHaveBeenCalledWith(expect.any(Function));
    const cleanup = afterMock.mock.calls[0]?.[0] as () => Promise<void>;
    await cleanup();

    expect(from).toHaveBeenCalledWith("order_status_sessions");
    expect(deleteQuery).toHaveBeenCalledOnce();
    expect(deleteLte).toHaveBeenCalledWith(
      "expires_at",
      "2026-09-14T12:28:00.000Z"
    );
  });

  test("swallows and logs scheduled cleanup errors", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-14T12:28:00.000Z"));
    deleteLte.mockResolvedValue({
      error: { message: "database unavailable" },
    });
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    const { scheduleExpiredOrderStatusSessionCleanup } = await import(
      "@/lib/payment/order-status-sessions"
    );

    scheduleExpiredOrderStatusSessionCleanup();
    const cleanup = afterMock.mock.calls[0]?.[0] as () => Promise<void>;

    await expect(cleanup()).resolves.toBeUndefined();
    expect(deleteLte).toHaveBeenCalledWith(
      "expires_at",
      "2026-09-14T12:28:00.000Z"
    );
    expect(consoleError).toHaveBeenCalledWith(
      "Failed to clean expired order status sessions."
    );
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

  test("throws when the resolver receives a non-not-found database error", async () => {
    const resolverError = { code: "42501", message: "permission denied" };
    resolveSingle.mockResolvedValue({ data: null, error: resolverError });
    const { resolveActiveOrderStatusSession } = await import(
      "@/lib/payment/order-status-sessions"
    );

    await expect(
      resolveActiveOrderStatusSession({
        sessionId,
        paymentOrderId: "KSP-123",
        rawToken: "secret",
      })
    ).rejects.toMatchObject({
      message: "Failed to resolve order status session.",
      cause: resolverError,
    });
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
