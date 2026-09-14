import { beforeEach, describe, expect, test, vi } from "vitest";

const { getScalevCheckoutAvailabilityMock } = vi.hoisted(() => ({
  getScalevCheckoutAvailabilityMock: vi.fn(),
}));

vi.mock("@/lib/scalev/client", () => ({
  getScalevCheckoutAvailability: getScalevCheckoutAvailabilityMock,
}));

describe("getScalevCheckoutConfig", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("SCALEV_API_KEY", "test-api-key");
    vi.stubEnv("SCALEV_STORE_UNIQUE_ID", "store-123");
    vi.stubEnv("SCALEV_DISABLED_PAYMENT_METHODS", "invoice");
    getScalevCheckoutAvailabilityMock.mockResolvedValue({
      paymentMethods: ["qris", "va"],
      subPaymentMethods: ["BCA"],
    });
  });

  test("builds a serializable checkout config from current availability", async () => {
    const { getScalevCheckoutConfig } = await import(
      "@/lib/scalev/checkout-config"
    );

    const config = await getScalevCheckoutConfig();

    expect(config).toEqual({
      availability: "available",
      storeUniqueId: "store-123",
      paymentOptions: [
        { code: "qris", label: "QRIS" },
        {
          code: "va",
          label: "Virtual Account",
          subMethods: ["BCA"],
        },
      ],
      disabledPaymentMethods: ["invoice"],
      paymentNotice:
        "Beberapa metode pembayaran sementara disembunyikan karena kendala provider. Gunakan metode yang tersedia.",
    });
    expect(() => JSON.stringify(config)).not.toThrow();
  });

  test("does not cache provider availability between loader calls", async () => {
    const { getScalevCheckoutConfig } = await import(
      "@/lib/scalev/checkout-config"
    );

    await getScalevCheckoutConfig();
    await getScalevCheckoutConfig();

    expect(getScalevCheckoutAvailabilityMock).toHaveBeenCalledTimes(2);
  });

  test("bounds provider availability loading with an abort signal", async () => {
    const { getScalevCheckoutConfig } = await import(
      "@/lib/scalev/checkout-config"
    );

    await getScalevCheckoutConfig();

    expect(getScalevCheckoutAvailabilityMock).toHaveBeenCalledWith(
      expect.any(AbortSignal)
    );
  });
});
