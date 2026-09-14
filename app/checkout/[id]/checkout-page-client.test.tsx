import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { CheckoutPageClient } from "@/app/checkout/[id]/checkout-page-client";
import { ToastProvider } from "@/context/ToastContext";
import type { ScalevCheckoutConfig } from "@/lib/scalev/types";
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

const initialPaymentConfig: ScalevCheckoutConfig = {
  availability: "available",
  storeUniqueId: "store-123",
  paymentNotice: undefined,
  paymentOptions: [{ code: "qris", label: "QRIS" }],
};

function renderCheckout(
  paymentConfig: ScalevCheckoutConfig = initialPaymentConfig
) {
  render(
    <ToastProvider>
      <CheckoutPageClient
        service={service}
        initialPaymentConfig={paymentConfig}
      />
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

  test("renders preloaded payment options without a mount-time request", () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    renderCheckout();

    expect(screen.getByText("Selesaikan Pembelian")).toBeInTheDocument();
    expect(screen.getByText("Ringkasan Pesanan")).toBeInTheDocument();
    expect(screen.getByText("QRIS")).toBeInTheDocument();
    expect(screen.queryByText("Sedang menyiapkan metode pembayaran...")).not.toBeInTheDocument();
    expect(screen.queryByText("Memproses Pembayaran...")).not.toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test("shows loading and requests payment options when retrying an empty preload", async () => {
    let resolveRetry:
      | ((response: {
          ok: boolean;
          json: () => Promise<{
            success: boolean;
            config: ScalevCheckoutConfig;
          }>;
        }) => void)
      | undefined;
    const fetchMock = vi.fn(
      () =>
        new Promise((resolve) => {
          resolveRetry = resolve;
        })
    );
    vi.stubGlobal("fetch", fetchMock);

    renderCheckout({
      availability: "unavailable",
      storeUniqueId: "store-123",
      paymentOptions: [],
    });

    expect(
      screen.getByText("Metode pembayaran sedang tidak tersedia.")
    ).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Coba Muat Ulang" }));

    expect(
      screen.getByText("Sedang menyiapkan metode pembayaran...")
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Coba Muat Ulang" })
    ).not.toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith("/api/scalev/payment-options", {
      cache: "no-store",
    });

    resolveRetry?.({
      ok: true,
      json: async () => ({
        success: true,
        config: initialPaymentConfig,
      }),
    });

    expect(await screen.findByText("QRIS")).toBeInTheDocument();
  });

  test("preserves explicit retry after a failed payment-options request", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ success: false }),
    });
    vi.stubGlobal("fetch", fetchMock);

    renderCheckout({
      availability: "unavailable",
      storeUniqueId: "store-123",
      paymentOptions: [],
    });

    fireEvent.click(screen.getByRole("button", { name: "Coba Muat Ulang" }));

    expect(
      await screen.findByText("Gagal memuat metode pembayaran. Coba muat ulang.")
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Coba Muat Ulang" })
    ).toBeEnabled();
  });

  test("shows conditional recipient contact fields based on sendTo and delivery method", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    renderCheckout();

    expect(screen.getByText("QRIS")).toBeInTheDocument();
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

  test("associates checkout labels, descriptions, radio cards, and keyboard controls", async () => {
    const user = userEvent.setup();
    vi.stubGlobal("fetch", vi.fn());

    renderCheckout({
      availability: "available",
      storeUniqueId: "store-123",
      paymentOptions: [
        { code: "qris", label: "QRIS" },
        { code: "va", label: "Virtual Account", subMethods: ["BCA", "BNI"] },
      ],
    });

    expect(screen.getByLabelText("Nama Penerima")).toHaveAttribute(
      "id",
      "checkout-recipient-name"
    );
    expect(screen.getByLabelText("Pesan untuk Penerima")).toHaveAttribute(
      "id",
      "checkout-sender-message"
    );
    expect(screen.getByLabelText("WhatsApp Penerima")).toHaveAttribute(
      "id",
      "checkout-recipient-phone"
    );
    expect(screen.getByLabelText("Nama Lengkap")).toHaveAttribute(
      "id",
      "checkout-customer-name"
    );
    expect(screen.getByLabelText("Email", { selector: "#checkout-customer-email" })).toHaveAttribute(
      "id",
      "checkout-customer-email"
    );
    expect(screen.getByLabelText("WhatsApp", { selector: "#checkout-customer-phone" })).toHaveAttribute(
      "id",
      "checkout-customer-phone"
    );

    const recipientName = screen.getByLabelText("Nama Penerima");
    expect(recipientName).toHaveAttribute(
      "aria-describedby",
      "checkout-recipient-name-help"
    );
    expect(document.getElementById("checkout-recipient-name-help")).toHaveTextContent(
      "Nama ini akan tercetak di voucher."
    );
    const ids = Array.from(document.querySelectorAll("[id]"), (element) => element.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const label of document.querySelectorAll("label")) {
      expect(label.htmlFor).not.toBe("");
      expect(document.getElementById(label.htmlFor)).not.toBeNull();
    }
    for (const control of document.querySelectorAll("[aria-describedby]")) {
      for (const descriptionId of control.getAttribute("aria-describedby")!.split(" ")) {
        expect(document.getElementById(descriptionId)).not.toBeNull();
      }
    }
    for (const radio of document.querySelectorAll('input[type="radio"].sr-only')) {
      expect(radio.closest("label")?.className).toMatch(
        /\bfocus(?:-visible|-within)?:/
      );
    }

    const sendToPurchaser = screen.getByRole("radio", { name: "Kirim ke Saya" });
    const sendToCard = sendToPurchaser.closest("label");
    expect(sendToPurchaser).toHaveAttribute("id", "checkout-send-to-PURCHASER");
    expect(sendToCard).toHaveAttribute("for", "checkout-send-to-PURCHASER");
    expect(sendToCard?.className).toMatch(/\bfocus(?:-visible|-within)?:/);

    sendToPurchaser.focus();
    await user.keyboard("[Space]");
    expect(sendToPurchaser).toBeChecked();

    const sendToRecipient = screen.getByRole("radio", {
      name: "Langsung ke Penerima",
    });
    sendToRecipient.focus();
    await user.keyboard("[Space]");
    expect(sendToRecipient).toBeChecked();

    const emailDelivery = screen.getByRole("radio", { name: "Email" });
    emailDelivery.focus();
    await user.keyboard("[Space]");
    expect(emailDelivery).toBeChecked();
    expect(await screen.findByLabelText("Email Penerima")).toHaveAttribute(
      "id",
      "checkout-recipient-email"
    );

    const vaPayment = screen.getByRole("radio", { name: /^Virtual Account/ });
    expect(vaPayment).toHaveAttribute("id", "checkout-payment-va");
    expect(vaPayment.closest("label")).toHaveAttribute("for", "checkout-payment-va");
    await user.click(vaPayment);
    expect(screen.getByLabelText("Bank Virtual Account")).toHaveAttribute(
      "id",
      "checkout-va-bank"
    );

    await user.click(screen.getAllByRole("button", { name: "Lanjut ke Pembayaran" })[0]);

    await waitFor(() => expect(recipientName).toHaveAttribute("aria-invalid", "true"));
    expect(recipientName).toHaveAttribute(
      "aria-describedby",
      "checkout-recipient-name-help checkout-recipient-name-error"
    );
    expect(document.getElementById("checkout-recipient-name-error")).toHaveTextContent(
      "Nama penerima wajib diisi"
    );
    expect(recipientName).toHaveFocus();
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
          paymentLink: "https://app.scalev.id/order/public/secret-token",
          paymentOrderId: "KSP-123",
          statusSessionId: "status-session-1",
        }),
      });

    vi.stubGlobal("fetch", fetchMock);
    vi.stubGlobal("open", vi.fn(() => popup as never));

    renderCheckout();

    expect(screen.getByText("QRIS")).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText("Nama penerima voucher"), {
      target: { value: "Penerima" },
    });
    fireEvent.click(screen.getByRole("radio", { name: "Kirim ke Saya" }));
    fireEvent.change(screen.getByPlaceholderText("Nama kamu"), {
      target: { value: "Faiz" },
    });
    fireEvent.change(screen.getByPlaceholderText("nama@email.com"), {
      target: { value: "faiz@example.com" },
    });
    fireEvent.change(screen.getByPlaceholderText("+62 812 3456 7890"), {
      target: { value: "0812-3456 7890" },
    });

    fireEvent.click(screen.getAllByRole("button", { name: "Lanjut ke Pembayaran" })[0]);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    const createPaymentCall = fetchMock.mock.calls[0];
    expect(createPaymentCall?.[0]).toBe("/api/scalev/create-payment");
    expect(JSON.parse(createPaymentCall?.[1]?.body as string)).toEqual(
      expect.objectContaining({
        sendTo: "PURCHASER",
        deliveryMethod: "WHATSAPP",
        customerPhone: "0812 3456 7890",
      })
    );
    expect(JSON.parse(createPaymentCall?.[1]?.body as string)).not.toHaveProperty(
      "recipientPhone"
    );

    await waitFor(() => {
      expect(push).toHaveBeenCalledWith(
        "/checkout/success?order_id=KSP-123&status_session_id=status-session-1"
      );
    });

    expect(popup.document.write).toHaveBeenCalled();
    expect(popup.close).toHaveBeenCalled();
    expect(popup.location.href).toBe("");
  });

  test("applies discount on Enter without submitting the checkout form", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          pricing: {
            code: "HEMAT10",
            discountAmount: 45000,
            totalAmount: 405000,
          },
        }),
      });

    vi.stubGlobal("fetch", fetchMock);
    vi.stubGlobal("open", vi.fn(() => null));

    renderCheckout();

    expect(screen.getByText("QRIS")).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText("Nama penerima voucher"), {
      target: { value: "Penerima" },
    });
    fireEvent.change(screen.getByPlaceholderText("Nama kamu"), {
      target: { value: "Faiz" },
    });
    fireEvent.change(screen.getByPlaceholderText("nama@email.com"), {
      target: { value: "faiz@example.com" },
    });
    const phoneInputs = screen.getAllByPlaceholderText("+62 812 3456 7890");
    fireEvent.change(phoneInputs[0], {
      target: { value: "0812-3456 7000" },
    });
    fireEvent.change(phoneInputs[1], {
      target: { value: "0812-3456 7890" },
    });

    const discountInput = screen.getByPlaceholderText("Masukkan kode promo");
    fireEvent.change(discountInput, {
      target: { value: "hemat10" },
    });
    fireEvent.keyDown(discountInput, { key: "Enter", code: "Enter" });

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    expect(fetchMock.mock.calls[0]?.[0]).toBe("/api/discount-codes/preview");
    expect(push).not.toHaveBeenCalled();
  });
});
