import { beforeEach, describe, expect, test, vi } from "vitest";

const { fromMock } = vi.hoisted(() => ({ fromMock: vi.fn() }));

vi.mock("@/lib/supabase/admin", () => ({
  getAdminClient: () => ({ from: fromMock }),
}));

vi.mock("@/lib/scalev/mappers", () => ({
  mapScalevPaymentMethodToLocal: vi.fn(() => "BANK_TRANSFER"),
}));

function updateBuilder(data: { id: string } | null) {
  const builder = {
    update: vi.fn(),
    eq: vi.fn(),
    select: vi.fn(),
    maybeSingle: vi.fn().mockResolvedValue({ data, error: null }),
  };
  builder.update.mockReturnValue(builder);
  builder.eq.mockReturnValue(builder);
  builder.select.mockReturnValue(builder);
  return builder;
}

describe("voucher link writes", () => {
  beforeEach(() => vi.clearAllMocks());

  test.each([
    ["order", "updateOrderVoucherId"],
    ["order item", "updateOrderItemVoucherId"],
  ] as const)("returns false when a %s update affects zero rows", async (_label, name) => {
    fromMock.mockReturnValue(updateBuilder(null));
    const writes = await import("@/lib/payment/order-writes");

    await expect(writes[name]("source-1", "voucher-1")).resolves.toBe(false);
  });
});
