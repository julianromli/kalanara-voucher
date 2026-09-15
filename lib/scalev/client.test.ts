import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

vi.mock("@/lib/scalev/network", () => ({
  ensureScalevIpv4First: vi.fn(),
}));

describe("getScalevCheckoutAvailability", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    vi.stubEnv("SCALEV_API_BASE_URL", "https://api.scalev.id/v2");
    vi.stubEnv("SCALEV_API_KEY", "test-api-key");
    vi.stubEnv("SCALEV_WEBHOOK_SIGNING_SECRET", "test-signing-secret");
    vi.stubEnv("SCALEV_STORE_UNIQUE_ID", "store-123");
    vi.stubEnv("SCALEV_STORE_NAME", "Kalanara Spa");
    vi.stubEnv("SCALEV_PAYMENT_METHODS", "qris,va");
    vi.stubEnv("SCALEV_VA_BANKS", "BCA,BNI");
    vi.stubEnv("SCALEV_DISABLED_PAYMENT_METHODS", "");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  test("forwards the loader abort signal to each provider request", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        text: async () =>
          JSON.stringify({
            data: {
              results: [
                {
                  id: 123,
                  name: "Kalanara Spa",
                  unique_id: "store-123",
                  sub_payment_methods: ["BCA"],
                },
              ],
            },
          }),
      })
      .mockResolvedValueOnce({
        ok: true,
        text: async () => JSON.stringify({ data: ["qris", "va"] }),
      });
    vi.stubGlobal("fetch", fetchMock);
    const signal = new AbortController().signal;
    const { getScalevCheckoutAvailability } = await import(
      "@/lib/scalev/client"
    );

    const availability = await getScalevCheckoutAvailability(signal);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(availability.source).toBe("provider");
    expect(fetchMock.mock.calls[0]?.[1]).toEqual(
      expect.objectContaining({ signal })
    );
    expect(fetchMock.mock.calls[1]?.[1]).toEqual(
      expect.objectContaining({ signal })
    );
  });

  test("marks configured values as fallback when the provider request fails", async () => {
    vi.stubEnv("SCALEV_PAYMENT_METHODS", "qris,va");
    vi.stubEnv("SCALEV_VA_BANKS", "BCA,BNI");
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("provider down")));
    const { getScalevCheckoutAvailability } = await import(
      "@/lib/scalev/client"
    );

    await expect(getScalevCheckoutAvailability()).resolves.toEqual(
      expect.objectContaining({
        source: "fallback",
        paymentMethods: ["qris", "va"],
        subPaymentMethods: ["BCA", "BNI"],
      })
    );
  });

  test("does not hide hard local configuration errors behind fallback", async () => {
    vi.stubEnv("SCALEV_API_KEY", "");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const { getScalevCheckoutAvailability } = await import(
      "@/lib/scalev/client"
    );

    await expect(getScalevCheckoutAvailability()).rejects.toThrow(
      "Missing required environment variable: SCALEV_API_KEY"
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
