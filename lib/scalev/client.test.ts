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

describe("Scalev v3 catalog requests", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    vi.stubEnv("SCALEV_API_KEY", "test-api-key");
    vi.stubEnv("SCALEV_API_BASE_URL", "https://payments.example/v2");
    vi.stubEnv("SCALEV_CATALOG_API_BASE_URL", "https://catalog.example/v3");
  });

  test("lists products through the v3 catalog API", async () => {
    const products = [
      {
        id: 123,
        name: "Balinese Massage",
        variants: [],
      },
    ];
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => JSON.stringify({ data: products }),
    });
    vi.stubGlobal("fetch", fetchMock);
    const { listScalevProducts } = await import("@/lib/scalev/client");

    await expect(listScalevProducts("Balinese")).resolves.toEqual(products);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://catalog.example/v3/products?search=Balinese&page_size=25",
      expect.objectContaining({ cache: "no-store" })
    );
  });

  test("updates product fields and variant price through separate v3 endpoints", async () => {
    const product = {
      id: 123,
      name: "Balinese Massage",
      variants: [
        {
          id: 456,
          unique_id: "variant-456",
          name: "Balinese Massage",
          price: 450000,
          weight: 1,
        },
      ],
    };
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        text: async () => JSON.stringify(product),
      })
      .mockResolvedValueOnce({
        ok: true,
        text: async () => "",
      })
      .mockResolvedValueOnce({
        ok: true,
        text: async () => JSON.stringify(product),
      });
    vi.stubGlobal("fetch", fetchMock);
    const { updateScalevProduct } = await import("@/lib/scalev/client");

    await expect(
      updateScalevProduct(123, {
        name: "Balinese Massage",
        description: "Relaxing treatment",
        publicName: "Balinese Massage",
        richDescription: "Relaxing treatment",
        itemType: "digital",
        variants: [
          {
            variantId: 456,
            name: "Balinese Massage Voucher",
            price: 450000,
            weight: 1,
          },
        ],
      })
    ).resolves.toEqual({
      product,
      primaryVariant: product.variants[0],
    });

    const productUpdateBody = JSON.parse(
      String(fetchMock.mock.calls[0]?.[1]?.body)
    ) as Record<string, unknown>;
    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      "https://catalog.example/v3/products/123"
    );
    expect(productUpdateBody).not.toHaveProperty("variants");
    expect(fetchMock.mock.calls[1]?.[0]).toBe(
      "https://catalog.example/v3/products/123/variants/bulk"
    );
    expect(fetchMock.mock.calls[1]?.[1]).toEqual(
      expect.objectContaining({ method: "PATCH" })
    );
    expect(JSON.parse(String(fetchMock.mock.calls[1]?.[1]?.body))).toEqual({
      field: "price",
      value: 450000,
    });
    expect(fetchMock.mock.calls[2]?.[0]).toBe(
      "https://catalog.example/v3/products/123"
    );
  });

  test("surfaces v3 catalog failures", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 403,
        text: async () =>
          JSON.stringify({ error: "Missing product:update scope" }),
      })
    );
    const { getScalevProduct } = await import("@/lib/scalev/client");

    await expect(getScalevProduct(123)).rejects.toThrow(
      "Scalev request failed: 403 /products/123"
    );
  });
});
