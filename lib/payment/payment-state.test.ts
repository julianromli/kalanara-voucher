import { beforeEach, describe, expect, test, vi } from "vitest";

const { rpcMock, revalidateTagMock } = vi.hoisted(() => ({
  rpcMock: vi.fn(),
  revalidateTagMock: vi.fn(),
}));

vi.mock("@/lib/supabase/admin", () => ({
  getAdminClient: () => ({ rpc: rpcMock }),
}));

vi.mock("next/cache", () => ({
  revalidateTag: revalidateTagMock,
}));

describe("transitionOrderPaymentState", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("maps an accepted transition and sends every gateway field explicitly", async () => {
    const { transitionOrderPaymentState } = await import(
      "@/lib/payment/payment-state"
    );
    rpcMock.mockResolvedValue({
      data: [
        {
          accepted: true,
          changed: true,
          reason: "applied",
          previous_status: "PENDING",
          current_status: "COMPLETED",
          state_version: 4,
        },
      ],
      error: null,
    });

    await expect(
      transitionOrderPaymentState({
        orderId: "order-1",
        targetStatus: "COMPLETED",
        provider: "scalev",
        providerEventAt: "2026-09-14T12:00:00.000Z",
        expectedVersion: 3,
        gatewayUpdate: {
          transactionId: "pg-1",
          paymentType: "qris",
          transactionTime: "2026-09-14T11:59:00.000Z",
          paymentLink: "https://app.scalev.id/pay",
          scalevOrderPk: "01a0a3c9-8c50-7bd7-9086-9a33c5bcc8e6",
          scalevOrderId: "scalev-1",
          scalevPgReferenceId: "pg-1",
          scalevPaymentMethod: "qris",
          scalevSubPaymentMethod: "BCA",
          scalevStoreUniqueId: "store-1",
          scalevRawStatus: "completed",
          scalevRawPaymentStatus: "paid",
          scalevLastCheckedAt: "2026-09-14T12:00:01.000Z",
        },
      })
    ).resolves.toEqual({
      accepted: true,
      changed: true,
      reason: "applied",
      previousStatus: "PENDING",
      currentStatus: "COMPLETED",
      stateVersion: 4,
    });

    expect(rpcMock).toHaveBeenCalledWith(
      "transition_order_payment_state",
      expect.objectContaining({
        p_order_id: "order-1",
        p_target_status: "COMPLETED",
        p_provider: "scalev",
        p_provider_event_at: "2026-09-14T12:00:00.000Z",
        p_expected_version: 3,
        p_transaction_id: "pg-1",
        p_payment_type: "qris",
        p_transaction_time: "2026-09-14T11:59:00.000Z",
        p_payment_link: "https://app.scalev.id/pay",
        p_scalev_order_pk: "01a0a3c9-8c50-7bd7-9086-9a33c5bcc8e6",
        p_scalev_order_id: "scalev-1",
        p_scalev_pg_reference_id: "pg-1",
        p_scalev_payment_method: "qris",
        p_scalev_sub_payment_method: "BCA",
        p_scalev_store_unique_id: "store-1",
        p_scalev_raw_status: "completed",
        p_scalev_raw_payment_status: "paid",
        p_scalev_last_checked_at: "2026-09-14T12:00:01.000Z",
      })
    );
    expect(revalidateTagMock).toHaveBeenCalledWith("dashboard-stats", "max");
  });

  test.each([
    "not_found",
    "missing_provider_event_at",
    "version_conflict",
    "stale_provider_event",
    "transition_rejected",
  ] as const)("preserves the %s rejection reason", async (reason) => {
    const { transitionOrderPaymentState } = await import(
      "@/lib/payment/payment-state"
    );
    rpcMock.mockResolvedValue({
      data: [
        {
          accepted: false,
          changed: false,
          reason,
          previous_status: "COMPLETED",
          current_status: "COMPLETED",
          state_version: 8,
        },
      ],
      error: null,
    });

    const result = await transitionOrderPaymentState({
      orderId: "order-1",
      targetStatus: "PENDING",
      provider: "scalev",
      providerEventAt: "2026-09-14T12:00:00.000Z",
    });

    expect(result).toEqual({
      accepted: false,
      changed: false,
      reason,
      currentStatus: "COMPLETED",
      stateVersion: 8,
    });
    expect(revalidateTagMock).not.toHaveBeenCalled();
  });

  test.each([
    { data: null, error: { message: "rpc unavailable" } },
    { data: [], error: null },
    { data: [{ accepted: true, reason: "surprise" }], error: null },
  ])("returns database_error for RPC errors or malformed rows", async (response) => {
    const { transitionOrderPaymentState } = await import(
      "@/lib/payment/payment-state"
    );
    rpcMock.mockResolvedValue(response);

    await expect(
      transitionOrderPaymentState({
        orderId: "order-1",
        targetStatus: "PENDING",
        provider: "scalev",
        providerEventAt: "2026-09-14T12:00:00.000Z",
      })
    ).resolves.toEqual({
      accepted: false,
      changed: false,
      reason: "database_error",
    });
    expect(revalidateTagMock).not.toHaveBeenCalled();
  });

  test("returns database_error when the RPC client throws", async () => {
    const { transitionOrderPaymentState } = await import(
      "@/lib/payment/payment-state"
    );
    rpcMock.mockRejectedValue(new Error("network failure"));

    await expect(
      transitionOrderPaymentState({
        orderId: "order-1",
        targetStatus: "PENDING",
        provider: "scalev",
        providerEventAt: "2026-09-14T12:00:00.000Z",
      })
    ).resolves.toEqual({
      accepted: false,
      changed: false,
      reason: "database_error",
    });
  });

  test("preserves an accepted transition when cache invalidation throws", async () => {
    const { transitionOrderPaymentState } = await import(
      "@/lib/payment/payment-state"
    );
    rpcMock.mockResolvedValue({
      data: [{
        accepted: true,
        changed: true,
        reason: "applied",
        previous_status: "PENDING",
        current_status: "COMPLETED",
        state_version: 2,
      }],
      error: null,
    });
    revalidateTagMock.mockImplementation(() => {
      throw new Error("cache unavailable");
    });

    await expect(
      transitionOrderPaymentState({
        orderId: "order-1",
        targetStatus: "COMPLETED",
        provider: "scalev",
        providerEventAt: "2026-09-14T12:00:00.000Z",
        providerEventAtIsFallback: false,
      })
    ).resolves.toMatchObject({
      accepted: true,
      currentStatus: "COMPLETED",
    });
  });
});
