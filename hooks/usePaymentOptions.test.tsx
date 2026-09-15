import { act, renderHook } from "@testing-library/react";
import { usePaymentOptions } from "@/hooks/usePaymentOptions";
import type { ScalevCheckoutConfig } from "@/lib/scalev/types";

const initialConfig: ScalevCheckoutConfig = {
  availability: "available",
  storeUniqueId: "kalanara",
  paymentOptions: [
    { code: "qris", label: "QRIS" },
    { code: "va", label: "Virtual Account", subMethods: ["BCA", "BNI"] },
  ],
};

function paymentOptionsResponse(config: ScalevCheckoutConfig) {
  return {
    ok: true,
    json: vi.fn().mockResolvedValue({ success: true, config }),
  } as unknown as Response;
}

describe("usePaymentOptions", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("selects the first initial payment option", () => {
    const { result } = renderHook(() => usePaymentOptions(initialConfig));

    expect(result.current.paymentConfig).toBe(initialConfig);
    expect(result.current.paymentMethod).toBe("qris");
    expect(result.current.selectedPaymentOption).toEqual(
      initialConfig.paymentOptions[0]
    );
    expect(result.current.paymentError).toBeNull();
  });

  it("allows only one retry request in flight", async () => {
    let resolveResponse: ((response: Response) => void) | undefined;
    const responsePromise = new Promise<Response>((resolve) => {
      resolveResponse = resolve;
    });
    const fetchMock = vi.mocked(fetch).mockReturnValue(responsePromise);
    const { result } = renderHook(() => usePaymentOptions(initialConfig));

    await act(async () => {
      const firstRetry = result.current.retryPaymentOptions();
      const guardedRetry = result.current.retryPaymentOptions();

      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(fetchMock).toHaveBeenCalledWith("/api/scalev/payment-options", {
        cache: "no-store",
      });

      resolveResponse?.(paymentOptionsResponse(initialConfig));
      await Promise.all([firstRetry, guardedRetry]);
    });

    expect(result.current.isPaymentConfigRetrying).toBe(false);
  });

  it("retains a valid selection and falls back when it disappears", async () => {
    const retainedConfig: ScalevCheckoutConfig = {
      ...initialConfig,
      paymentOptions: [
        { code: "va", label: "Virtual Account", subMethods: ["BCA"] },
        { code: "invoice", label: "Invoice" },
      ],
    };
    const fallbackConfig: ScalevCheckoutConfig = {
      ...initialConfig,
      paymentOptions: [{ code: "invoice", label: "Invoice" }],
    };
    vi.mocked(fetch)
      .mockResolvedValueOnce(paymentOptionsResponse(retainedConfig))
      .mockResolvedValueOnce(paymentOptionsResponse(fallbackConfig));
    const { result } = renderHook(() => usePaymentOptions(initialConfig));

    act(() => {
      result.current.setPaymentMethod("va");
    });
    await act(async () => {
      await result.current.retryPaymentOptions();
    });
    expect(result.current.paymentMethod).toBe("va");

    await act(async () => {
      await result.current.retryPaymentOptions();
    });
    expect(result.current.paymentMethod).toBe("invoice");
    expect(result.current.selectedPaymentOption).toEqual(
      fallbackConfig.paymentOptions[0]
    );
  });

  it("exposes the exact retry error when loading fails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.mocked(fetch).mockResolvedValue({
      ok: false,
    } as Response);
    const { result } = renderHook(() => usePaymentOptions(initialConfig));

    await act(async () => {
      await result.current.retryPaymentOptions();
    });

    expect(result.current.paymentError).toBe(
      "Gagal memuat metode pembayaran. Coba muat ulang."
    );
    expect(result.current.isPaymentConfigRetrying).toBe(false);
  });
});
