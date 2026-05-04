import { beforeEach, describe, expect, test, vi } from "vitest";

const {
  getServiceByIdMock,
  validateDiscountForCheckoutMock,
} = vi.hoisted(() => ({
  getServiceByIdMock: vi.fn(),
  validateDiscountForCheckoutMock: vi.fn(),
}));

vi.mock("@/lib/actions/services", () => ({
  getServiceById: getServiceByIdMock,
}));

vi.mock("@/lib/discounts/service", () => ({
  validateDiscountForCheckout: validateDiscountForCheckoutMock,
}));

describe("POST /api/discount-codes/preview", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getServiceByIdMock.mockResolvedValue({
      id: "service-1",
      is_active: true,
      price: 450000,
    });
    validateDiscountForCheckoutMock.mockResolvedValue({
      valid: true,
      quote: {
        discountCodeId: "discount-1",
        code: "HEMAT10",
        discountType: "PERCENTAGE",
        discountValue: 10,
        subtotalAmount: 450000,
        discountAmount: 45000,
        totalAmount: 405000,
      },
    });
  });

  test("rejects preview payloads with too many service IDs", async () => {
    const { POST } = await import("@/app/api/discount-codes/preview/route");

    const response = await POST(
      new Request("http://localhost/api/discount-codes/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerEmail: "faiz@example.com",
          customerPhone: "081234567890",
          discountCode: "HEMAT10",
          serviceIds: Array.from({ length: 21 }, (_, index) => `service-${index}`),
        }),
      }) as never
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      success: false,
      error: "Data kode diskon tidak valid.",
    });
    expect(getServiceByIdMock).not.toHaveBeenCalled();
    expect(validateDiscountForCheckoutMock).not.toHaveBeenCalled();
  });
});
