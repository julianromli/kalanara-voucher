import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, test, vi } from "vitest";
import CheckoutSuccessPage from "@/app/checkout/success/page";
import { ToastProvider } from "@/context/ToastContext";
import { useCartStore } from "@/store/cart-store";

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
    localStorage.clear();
    useCartStore.setState({ items: [], pendingCheckout: null });
  });

  test("shows QRIS instructions and payment recovery CTA while payment is pending", async () => {
    const openMock = vi.fn();
    vi.stubGlobal("open", openMock);
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

    fireEvent.click(await screen.findByRole("button", { name: "Buka Halaman Pembayaran" }));

    expect(openMock).toHaveBeenCalledWith(
      "https://app.scalev.id/order/public/secret-token",
      "_blank"
    );
    expect(screen.getByText("Scan QRIS untuk membayar")).toBeInTheDocument();
    expect(screen.getByText(/10\.000/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cek Status Lagi" })).toBeInTheDocument();
  });

  test("shows hosted payment CTA for external payment links", async () => {
    const openMock = vi.fn();
    vi.stubGlobal("open", openMock);
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          status: "pending",
          orderId: "KSP-123",
          paymentStatus: "PENDING",
          paymentLink: "https://checkout.scalev.id/pay/hosted-123",
        }),
      })
    );

    render(
      <ToastProvider>
        <CheckoutSuccessPage />
      </ToastProvider>
    );

    fireEvent.click(await screen.findByRole("button", { name: "Buka Halaman Pembayaran" }));
    expect(openMock).toHaveBeenCalledWith(
      "https://checkout.scalev.id/pay/hosted-123",
      "_blank"
    );
  });

  test("clears matching pending cart items after payment completes", async () => {
    useCartStore.setState({
      items: [
        {
          id: "cart-1",
          service: {
            id: "service-1",
            name: "Balinese Massage",
            description: "Relaxing treatment",
            duration: 90,
            price: 450000,
          },
        },
        {
          id: "cart-2",
          service: {
            id: "service-2",
            name: "Hot Stone Massage",
            description: "Warm and relaxing",
            duration: 120,
            price: 550000,
          },
        },
      ],
      pendingCheckout: {
        paymentOrderId: "KSP-123",
        cartItemIds: ["cart-1"],
        createdAt: 1,
      },
    });

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          status: "completed",
          orderId: "KSP-123",
          paymentStatus: "COMPLETED",
          voucher: {
            voucherCode: "KSPV-001",
            paymentOrderId: "KSP-123",
            recipientName: "Penerima",
            recipientEmail: null,
            recipientPhone: "",
            senderName: "Faiz",
            senderMessage: "Selamat menikmati",
            serviceName: "Balinese Massage",
            serviceDuration: 90,
            amount: 450000,
            expiryDate: "2026-03-12T04:05:55.854402Z",
            deliveryMethod: "WHATSAPP",
            sendTo: "PURCHASER",
          },
        }),
      })
    );

    render(
      <ToastProvider>
        <CheckoutSuccessPage />
      </ToastProvider>
    );

    expect(await screen.findByText("Voucher dikirim ke WhatsApp kamu")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Download PDF" })).toBeInTheDocument();

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

    await waitFor(() => {
      expect(useCartStore.getState().items.map((item) => item.id)).toEqual(["cart-2"]);
      expect(useCartStore.getState().pendingCheckout).toBeNull();
    });
  });
});
