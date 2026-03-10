import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { ToastProvider } from "@/context/ToastContext";
import CheckoutSuccessPage from "@/app/checkout/success/page";

const push = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push,
  }),
  useSearchParams: () => ({
    get: (key: string) => {
      if (key === "order_id") return "KSP-123";
      if (key === "token") return "public-token";
      return null;
    },
  }),
}));

describe("CheckoutSuccessPage", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    push.mockReset();
  });

  test("shows QRIS instructions on the local success page while payment is still pending", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          status: "pending",
          orderId: "KSP-123",
          paymentStatus: "PENDING",
          paymentLink: "https://app.scalev.id/order/public/secret-token",
          paymentInstructions: {
            kind: "qris",
            qrString: "00020101021226TESTQRSTRING6304ABCD",
            amount: 10000,
            expiresAt: "2026-03-12T04:05:55.854402Z",
            channelCode: "XENDIT",
          },
        }),
      })
    );

    render(
      <ToastProvider>
        <CheckoutSuccessPage />
      </ToastProvider>
    );

    expect(await screen.findByText("Scan QRIS untuk membayar")).toBeInTheDocument();
    expect(screen.getByText("Nominal Rp 10.000")).toBeInTheDocument();
    expect(screen.queryByText("Buka Halaman Pembayaran")).not.toBeInTheDocument();

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith("/api/orders/public-status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({
          orderId: "KSP-123",
          token: "public-token",
        }),
      });
    });
  });
});
