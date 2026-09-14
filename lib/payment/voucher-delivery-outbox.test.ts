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

describe("voucher delivery outbox persistence", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  test("claims deliveries through the atomic RPC and returns claimed rows", async () => {
    const { claimVoucherDeliveries } = await import(
      "@/lib/payment/voucherDeliveryOutbox"
    );
    rpcMock.mockResolvedValue({
      data: [
        { id: "delivery-email", channel: "EMAIL", claim_token: "claim-email" },
        {
          id: "delivery-whatsapp",
          channel: "WHATSAPP",
          claim_token: "claim-whatsapp",
        },
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
      { id: "delivery-email", channel: "EMAIL", claimToken: "claim-email" },
      {
        id: "delivery-whatsapp",
        channel: "WHATSAPP",
        claimToken: "claim-whatsapp",
      },
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
      "@/lib/payment/voucherDeliveryOutbox"
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

  test("finalizes SENT atomically with the immutable claim token", async () => {
    const { markVoucherDeliverySent } = await import(
      "@/lib/payment/voucherDeliveryOutbox"
    );
    rpcMock.mockResolvedValue({ data: false, error: null });

    await expect(
      markVoucherDeliverySent("delivery-1", "claim-1")
    ).rejects.toThrow(
      /persist.*SENT/i
    );
    expect(rpcMock).toHaveBeenCalledWith("finalize_voucher_delivery_sent", {
      p_delivery_id: "delivery-1",
      p_claim_token: "claim-1",
    });
  });

  test("bounds errors and finalizes FAILED atomically with the claim token", async () => {
    const { markVoucherDeliveryFailed } = await import(
      "@/lib/payment/voucherDeliveryOutbox"
    );
    rpcMock.mockResolvedValue({ data: true, error: null });

    await markVoucherDeliveryFailed(
      "delivery-1",
      "claim-1",
      new Error(`provider: ${"x".repeat(2_000)}`)
    );

    expect(rpcMock).toHaveBeenCalledWith("finalize_voucher_delivery_failed", {
      p_delivery_id: "delivery-1",
      p_claim_token: "claim-1",
      p_error: expect.stringMatching(/^Error: provider: /),
    });
    expect(rpcMock.mock.calls[0][1].p_error).toHaveLength(1_000);
  });

  test("throws when FAILED persistence is not confirmed", async () => {
    const { markVoucherDeliveryFailed } = await import(
      "@/lib/payment/voucherDeliveryOutbox"
    );
    rpcMock.mockResolvedValue({
      data: false,
      error: { message: "write failed" },
    });

    await expect(
      markVoucherDeliveryFailed(
        "delivery-1",
        "claim-1",
        new Error("send failed")
      )
    ).rejects.toThrow("write failed");
  });
});
