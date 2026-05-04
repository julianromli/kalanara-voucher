import { beforeEach, describe, expect, test, vi } from "vitest";

const {
  maybeSingleMock,
  inMock,
  rpcMock,
} = vi.hoisted(() => ({
  maybeSingleMock: vi.fn(),
  inMock: vi.fn(),
  rpcMock: vi.fn(),
}));

vi.mock("@/lib/supabase/admin", () => ({
  getAdminClient: () => ({
    from: (table: string) => {
      if (table === "discount_codes") {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: maybeSingleMock,
            }),
          }),
        };
      }

      if (table === "discount_code_redemptions") {
        return {
          select: () => ({
            eq: () => ({
              in: inMock,
            }),
          }),
        };
      }

      throw new Error(`Unexpected table mock: ${table}`);
    },
    rpc: rpcMock,
  }),
}));

describe("discount reservation safeguards", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    maybeSingleMock.mockResolvedValue({
      data: {
        id: "discount-1",
        code: "HEMAT10",
        normalized_code: "HEMAT10",
        is_active: true,
        discount_type: "PERCENTAGE",
        discount_value: 10,
        starts_at: null,
        ends_at: null,
        max_total_uses: 1,
        max_uses_per_customer: 1,
        created_at: "2026-05-03T00:00:00.000Z",
        updated_at: "2026-05-03T00:00:00.000Z",
      },
      error: null,
    });
    inMock.mockResolvedValue({
      data: [],
      error: null,
    });
    rpcMock.mockReturnValue({
      returns: () =>
        Promise.resolve({
          data: [
            {
              success: true,
              reason: null,
              message: null,
              redemption_id: "redemption-1",
            },
          ],
          error: null,
        }),
    });
  });

  test("counts pending redemptions when validating discount availability", async () => {
    const { validateDiscountForCheckout } = await import("@/lib/discounts/service");

    inMock.mockResolvedValue({
      data: [
        {
          customer_email_normalized: "other@example.com",
          customer_phone_normalized: "6281234567890",
        },
      ],
      error: null,
    });

    const result = await validateDiscountForCheckout({
      discountCode: "HEMAT10",
      subtotalAmount: 450000,
      customerEmail: "faiz@example.com",
      customerPhone: "081234567890",
    });

    expect(result).toEqual({
      valid: false,
      reason: "GLOBAL_LIMIT_REACHED",
      message: "Kuota kode diskon sudah habis.",
    });
  });

  test("returns reservation failure details from the atomic RPC", async () => {
    const { createPendingDiscountRedemption } = await import("@/lib/discounts/service");

    rpcMock.mockReturnValue({
      returns: () =>
        Promise.resolve({
          data: [
            {
              success: false,
              reason: "CUSTOMER_LIMIT_REACHED",
              message: "Kode diskon sudah pernah dipakai untuk email atau nomor ini.",
              redemption_id: null,
            },
          ],
          error: null,
        }),
    });

    await expect(
      createPendingDiscountRedemption({
        discountCodeId: "discount-1",
        orderId: "order-1",
        customerEmail: "faiz@example.com",
        customerPhone: "081234567890",
        discountType: "PERCENTAGE",
        discountValue: 10,
        subtotalAmount: 450000,
        discountAmount: 45000,
        totalAmount: 405000,
      })
    ).resolves.toEqual({
      success: false,
      reason: "CUSTOMER_LIMIT_REACHED",
      message: "Kode diskon sudah pernah dipakai untuk email atau nomor ini.",
    });
  });
});
