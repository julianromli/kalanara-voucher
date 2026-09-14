import { beforeEach, describe, expect, test, vi } from "vitest";

vi.mock("@/lib/scalev/network", () => ({
  ensureScalevIpv4First: vi.fn(),
}));

describe("getScalevCheckoutAvailability", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    vi.stubEnv("SCALEV_API_KEY", "test-api-key");
    vi.stubEnv("SCALEV_STORE_UNIQUE_ID", "store-123");
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

    await getScalevCheckoutAvailability(signal);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[0]?.[1]).toEqual(
      expect.objectContaining({ signal })
    );
    expect(fetchMock.mock.calls[1]?.[1]).toEqual(
      expect.objectContaining({ signal })
    );
  });
});
