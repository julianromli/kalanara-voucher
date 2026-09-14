import { beforeEach, describe, expect, test, vi } from "vitest";

const { fromMock, rpcMock } = vi.hoisted(() => ({
  fromMock: vi.fn(),
  rpcMock: vi.fn(),
}));

vi.mock("@/lib/supabase/admin", () => ({
  getAdminClient: () => ({
    from: fromMock,
    rpc: rpcMock,
  }),
}));

function createUpdateBuilder(result: {
  data: { id: string } | null;
  error: { message: string } | null;
}) {
  const builder = {
    eq: vi.fn(),
    select: vi.fn(),
    maybeSingle: vi.fn().mockResolvedValue(result),
    update: vi.fn(),
  };
  builder.eq.mockReturnValue(builder);
  builder.select.mockReturnValue(builder);
  builder.update.mockReturnValue(builder);
  return builder;
}

function createAttemptBuilder(result: {
  data: { attempt_count: number } | null;
  error: { message: string } | null;
}) {
  const builder = {
    eq: vi.fn(),
    select: vi.fn(),
    single: vi.fn().mockResolvedValue(result),
  };
  builder.eq.mockReturnValue(builder);
  builder.select.mockReturnValue(builder);
  return builder;
}

describe("voucher delivery outbox persistence", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  test("claims deliveries through the atomic RPC and maps only valid rows", async () => {
    const { claimVoucherDeliveries } = await import(
      "@/lib/payment/voucher-delivery-outbox"
    );
    rpcMock.mockResolvedValue({
      data: [
        { id: "delivery-email", channel: "EMAIL" },
        { id: "delivery-whatsapp", channel: "WHATSAPP" },
      ],
      error: null,
    });

    await expect(
      claimVoucherDeliveries({
        orderId: "order-1",
        orderItemId: "item-1",
        voucherId: "voucher-1",
        channels: ["EMAIL", "WHATSAPP"],
      })
    ).resolves.toEqual([
      { id: "delivery-email", channel: "EMAIL" },
      { id: "delivery-whatsapp", channel: "WHATSAPP" },
    ]);
    expect(rpcMock).toHaveBeenCalledWith("claim_voucher_deliveries", {
      p_order_id: "order-1",
      p_order_item_id: "item-1",
      p_voucher_id: "voucher-1",
      p_channels: ["EMAIL", "WHATSAPP"],
    });
  });

  test("throws when claim persistence fails or returns a malformed row", async () => {
    const { claimVoucherDeliveries } = await import(
      "@/lib/payment/voucher-delivery-outbox"
    );
    rpcMock.mockResolvedValueOnce({
      data: null,
      error: { message: "rpc unavailable" },
    });
    await expect(
      claimVoucherDeliveries({
        orderId: "order-1",
        orderItemId: null,
        voucherId: "voucher-1",
        channels: ["EMAIL"],
      })
    ).rejects.toThrow("rpc unavailable");

    rpcMock.mockResolvedValueOnce({
      data: [{ id: "delivery-1", channel: "SMS" }],
      error: null,
    });
    await expect(
      claimVoucherDeliveries({
        orderId: "order-1",
        orderItemId: null,
        voucherId: "voucher-1",
        channels: ["EMAIL"],
      })
    ).rejects.toThrow(/invalid/i);
  });

  test("requires a PROCESSING row to persist SENT", async () => {
    const { markVoucherDeliverySent } = await import(
      "@/lib/payment/voucher-delivery-outbox"
    );
    const missingBuilder = createUpdateBuilder({ data: null, error: null });
    fromMock.mockReturnValue(missingBuilder);

    await expect(markVoucherDeliverySent("delivery-1")).rejects.toThrow(
      /persist.*SENT/i
    );
    expect(missingBuilder.update).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "SENT",
        claimed_at: null,
        last_error: null,
      })
    );
    expect(missingBuilder.eq).toHaveBeenCalledWith("status", "PROCESSING");
  });

  test("bounds errors and caps exponential FAILED retry at 60 minutes", async () => {
    const { markVoucherDeliveryFailed } = await import(
      "@/lib/payment/voucher-delivery-outbox"
    );
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-14T12:00:00.000Z"));
    const attemptBuilder = createAttemptBuilder({
      data: { attempt_count: 8 },
      error: null,
    });
    const updateBuilder = createUpdateBuilder({
      data: { id: "delivery-1" },
      error: null,
    });
    fromMock
      .mockReturnValueOnce(attemptBuilder)
      .mockReturnValueOnce(updateBuilder);

    await markVoucherDeliveryFailed(
      "delivery-1",
      new Error(`provider: ${"x".repeat(2_000)}`)
    );

    const update = updateBuilder.update.mock.calls[0][0];
    expect(update.status).toBe("FAILED");
    expect(update.claimed_at).toBeNull();
    expect(update.last_error).toHaveLength(1_000);
    expect(update.next_attempt_at).toBe("2026-09-14T13:00:00.000Z");
    expect(updateBuilder.eq).toHaveBeenCalledWith("status", "PROCESSING");
  });

  test("throws when FAILED persistence is not confirmed", async () => {
    const { markVoucherDeliveryFailed } = await import(
      "@/lib/payment/voucher-delivery-outbox"
    );
    fromMock
      .mockReturnValueOnce(
        createAttemptBuilder({
          data: { attempt_count: 1 },
          error: null,
        })
      )
      .mockReturnValueOnce(
        createUpdateBuilder({
          data: null,
          error: { message: "write failed" },
        })
      );

    await expect(
      markVoucherDeliveryFailed("delivery-1", new Error("send failed"))
    ).rejects.toThrow("write failed");
  });
});
