import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { useCheckoutDiscount } from "@/hooks/use-checkout-discount";

const serviceIds = ["service-1"];

describe("useCheckoutDiscount", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  test("applies a discount and normalizes its code", async () => {
    const showToast = vi.fn();
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        pricing: {
          code: "HEMAT10",
          discountType: "PERCENTAGE",
          discountValue: 10,
          subtotalAmount: 450000,
          discountAmount: 45000,
          totalAmount: 405000,
        },
      }),
    });
    vi.stubGlobal("fetch", fetchMock);
    const { result } = renderHook(() =>
      useCheckoutDiscount({
        customerEmail: " faiz@example.com ",
        customerPhone: "0812-3456 7890",
        serviceIds,
        showToast,
      })
    );

    act(() => result.current.setCodeInput("hemat10"));
    await act(() => result.current.applyDiscount());

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/discount-codes/preview",
      expect.objectContaining({
        body: JSON.stringify({
          customerEmail: "faiz@example.com",
          customerPhone: "0812 3456 7890",
          discountCode: "HEMAT10",
          serviceIds,
        }),
      })
    );
    expect(result.current.appliedDiscount?.code).toBe("HEMAT10");
    expect(result.current.codeInput).toBe("HEMAT10");
    expect(showToast).toHaveBeenCalledWith(
      "Kode diskon berhasil diterapkan.",
      "success"
    );
  });

  test("exposes a preview failure and clears an applied discount", async () => {
    const showToast = vi.fn();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        json: async () => ({
          success: false,
          error: "Kode sudah tidak berlaku.",
        }),
      })
    );
    const { result } = renderHook(() =>
      useCheckoutDiscount({
        customerEmail: "faiz@example.com",
        customerPhone: "081234567890",
        serviceIds,
        showToast,
      })
    );

    act(() => result.current.setCodeInput("lama"));
    await act(() => result.current.applyDiscount());

    expect(result.current.appliedDiscount).toBeNull();
    expect(result.current.error).toBe("Kode sudah tidak berlaku.");
    expect(showToast).toHaveBeenCalledWith(
      "Kode sudah tidak berlaku.",
      "error"
    );
  });

  test("resets an applied discount when customer data or resetKey changes", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          success: true,
          pricing: {
            code: "HEMAT10",
            discountType: "PERCENTAGE",
            discountValue: 10,
            subtotalAmount: 450000,
            discountAmount: 45000,
            totalAmount: 405000,
          },
        }),
      })
    );
    const showToast = vi.fn();
    const { result, rerender } = renderHook(
      ({
        customerEmail,
        resetKey,
      }: {
        customerEmail: string;
        resetKey: number;
      }) =>
        useCheckoutDiscount({
          customerEmail,
          customerPhone: "081234567890",
          serviceIds,
          resetKey,
          showToast,
        }),
      {
        initialProps: {
          customerEmail: "faiz@example.com",
          resetKey: 450000,
        },
      }
    );

    act(() => result.current.setCodeInput("hemat10"));
    await act(() => result.current.applyDiscount());
    expect(result.current.appliedDiscount).not.toBeNull();

    rerender({
      customerEmail: "baru@example.com",
      resetKey: 450000,
    });
    await waitFor(() => expect(result.current.appliedDiscount).toBeNull());

    act(() => result.current.setCodeInput("hemat10"));
    await act(() => result.current.applyDiscount());
    expect(result.current.appliedDiscount).not.toBeNull();

    rerender({
      customerEmail: "baru@example.com",
      resetKey: 550000,
    });
    await waitFor(() => expect(result.current.appliedDiscount).toBeNull());
  });
});
