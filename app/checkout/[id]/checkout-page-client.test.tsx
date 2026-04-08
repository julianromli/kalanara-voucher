import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { CheckoutPageClient } from "@/app/checkout/[id]/checkout-page-client";
import { ToastProvider } from "@/context/ToastContext";
import { ServiceCategory } from "@/lib/types";

const push = vi.fn();
const back = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push,
    back,
  }),
}));

const service = {
  id: "service-1",
  name: "Balinese Massage",
  description: "Relaxing treatment",
  duration: 90,
  price: 450000,
  category: ServiceCategory.MASSAGE,
  image: "https://example.com/service.jpg",
};

function renderCheckout() {
  render(
    <ToastProvider>
      <CheckoutPageClient service={service} />
    </ToastProvider>
  );
}

describe("CheckoutPageClient", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    push.mockReset();
    back.mockReset();
  });

  test("renders checkout shell while payment config is still loading", async () => {
    vi.stubGlobal("fetch", vi.fn(() => new Promise(() => {})));

    renderCheckout();

    expect(screen.getByText("Selesaikan Pembelian")).toBeInTheDocument();
    expect(screen.getByText("Ringkasan Pesanan")).toBeInTheDocument();
    expect(screen.getByText("Sedang menyiapkan metode pembayaran…")).toBeInTheDocument();
    expect(screen.queryByText("Memproses Pembayaran…")).not.toBeInTheDocument();
  });

  test("shows conditional recipient contact fields based on sendTo and delivery method", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          success: true,
          config: {
            paymentNotice: null,
            paymentOptions: [{ code: "qris", label: "QRIS" }],
          },
        }),
      })
    );

    renderCheckout();

    expect(await screen.findByText("QRIS")).toBeInTheDocument();
    expect(screen.getByText("WhatsApp Penerima")).toBeInTheDocument();
    expect(screen.queryByText("Email Penerima")).not.toBeInTheDocument();

    const emailDeliveryRadio = screen
      .getAllByRole("radio")
      .find((element) => (element as HTMLInputElement).value === "EMAIL");
    fireEvent.click(emailDeliveryRadio!);

    expect(await screen.findByText("Email Penerima")).toBeInTheDocument();
    expect(screen.queryByText("WhatsApp Penerima")).not.toBeInTheDocument();

    const bothDeliveryRadio = screen
      .getAllByRole("radio")
      .find((element) => (element as HTMLInputElement).value === "BOTH");
    fireEvent.click(bothDeliveryRadio!);

    expect(await screen.findByText("Email Penerima")).toBeInTheDocument();
    expect(screen.getByText("WhatsApp Penerima")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("radio", { name: "Kirim ke Saya" }));

    await waitFor(() => {
      expect(screen.queryByText("Email Penerima")).not.toBeInTheDocument();
      expect(screen.queryByText("WhatsApp Penerima")).not.toBeInTheDocument();
      expect(
        screen.getByText(
          "Voucher tetap memakai nama penerima di voucher, tetapi pengiriman akan dikirim ke kontak kamu."
        )
      ).toBeInTheDocument();
    });
  });

  test("submits purchaser WhatsApp checkout without recipient contact and writes popup shell", async () => {
    const popup = {
      close: vi.fn(),
      location: { href: "" },
      document: {
        open: vi.fn(),
        write: vi.fn(),
        close: vi.fn(),
      },
    };

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          config: {
            paymentNotice: null,
            paymentOptions: [{ code: "qris", label: "QRIS" }],
          },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          paymentLink: "https://app.scalev.id/order/public/secret-token",
          paymentOrderId: "KSP-123",
          publicAccessToken: "public-token",
        }),
      });

    vi.stubGlobal("fetch", fetchMock);
    vi.stubGlobal("open", vi.fn(() => popup as never));

    renderCheckout();

    expect(await screen.findByText("QRIS")).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText("Nama penerima voucher…"), {
      target: { value: "Penerima" },
    });
    fireEvent.click(screen.getByRole("radio", { name: "Kirim ke Saya" }));
    fireEvent.change(screen.getByPlaceholderText("Nama lengkap kamu…"), {
      target: { value: "Faiz" },
    });
    fireEvent.change(screen.getByPlaceholderText("nama@contoh.com…"), {
      target: { value: "faiz@example.com" },
    });
    fireEvent.change(screen.getByPlaceholderText("+62 812 3456 7890…"), {
      target: { value: "0812-3456 7890" },
    });

    fireEvent.click(screen.getAllByRole("button", { name: "Lanjut ke Pembayaran" })[0]);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    const secondCall = fetchMock.mock.calls[1];
    expect(secondCall?.[0]).toBe("/api/scalev/create-payment");
    expect(JSON.parse(secondCall?.[1]?.body as string)).toEqual(
      expect.objectContaining({
        sendTo: "PURCHASER",
        deliveryMethod: "WHATSAPP",
        customerPhone: "0812 3456 7890",
      })
    );
    expect(JSON.parse(secondCall?.[1]?.body as string)).not.toHaveProperty(
      "recipientPhone"
    );

    await waitFor(() => {
      expect(push).toHaveBeenCalledWith(
        "/checkout/success?order_id=KSP-123&token=public-token"
      );
    });

    expect(popup.document.write).toHaveBeenCalled();
    expect(popup.close).toHaveBeenCalled();
    expect(popup.location.href).toBe("");
  });
});
