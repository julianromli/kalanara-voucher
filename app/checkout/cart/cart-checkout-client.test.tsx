import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { CartCheckoutClient } from "@/app/checkout/cart/cart-checkout-client";
import { ToastProvider } from "@/context/ToastContext";
import type { ScalevCheckoutConfig } from "@/lib/scalev/types";
import { useCartStore } from "@/store/cart-store";

const push = vi.fn();
const back = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push,
    back,
  }),
}));

const initialPaymentConfig: ScalevCheckoutConfig = {
  availability: "available",
  storeUniqueId: "store-123",
  paymentOptions: [{ code: "qris", label: "QRIS" }],
};

function renderCheckout(
  paymentConfig: ScalevCheckoutConfig = initialPaymentConfig
) {
  render(
    <ToastProvider>
      <CartCheckoutClient initialPaymentConfig={paymentConfig} />
    </ToastProvider>
  );
}

describe("CartCheckoutClient", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    push.mockReset();
    back.mockReset();
    localStorage.clear();
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
      pendingCheckout: null,
    });
  });

  test("renders preloaded payment options without a mount-time request", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    renderCheckout();

    expect(await screen.findByText("QRIS")).toBeInTheDocument();
    expect(
      screen.queryByText("Sedang menyiapkan metode pembayaran...")
    ).not.toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test("shows loading and prevents duplicate requests while retrying an empty preload", async () => {
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
      await screen.findByText("Metode pembayaran sedang tidak tersedia.")
    ).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();

    const retryButton = screen.getByRole("button", { name: "Coba Muat Ulang" });
    fireEvent.click(retryButton);
    fireEvent.click(retryButton);

    expect(
      screen.getByText("Sedang menyiapkan metode pembayaran...")
    ).toBeInTheDocument();
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

    fireEvent.click(
      await screen.findByRole("button", { name: "Coba Muat Ulang" })
    );

    expect(
      await screen.findByText("Gagal memuat metode pembayaran. Coba muat ulang.")
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Coba Muat Ulang" })
    ).toBeEnabled();
  });

  test("collapses secondary vouchers into summaries and restores editable fields on toggle off", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    renderCheckout();

    expect(await screen.findByText("QRIS")).toBeInTheDocument();
    expect(screen.getAllByPlaceholderText("Nama penerima voucher")).toHaveLength(2);

    fireEvent.click(screen.getByLabelText("Gunakan penerima yang sama"));

    expect(screen.getAllByPlaceholderText("Nama penerima voucher")).toHaveLength(1);
    expect(screen.getByText("Semua voucher di bawah mengikuti Voucher 1.")).toBeInTheDocument();
    expect(screen.getByText("Data utama penerima")).toBeInTheDocument();
    expect(screen.getAllByText("Mengikuti Voucher 1").length).toBeGreaterThan(0);

    fireEvent.change(screen.getByPlaceholderText("Nama penerima voucher"), {
      target: { value: "Penerima Utama" },
    });

    const phoneInput = screen.getAllByPlaceholderText("+62 812 3456 7890")[1];
    fireEvent.change(phoneInput, {
      target: { value: "0812 9999 0000" },
    });

    await waitFor(() => {
      expect(screen.getByText("Penerima Utama")).toBeInTheDocument();
      expect(screen.getByText("0812 9999 0000")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByLabelText("Gunakan penerima yang sama"));

    expect(screen.getAllByPlaceholderText("Nama penerima voucher")).toHaveLength(2);
    expect(screen.getAllByDisplayValue("Penerima Utama")).toHaveLength(2);
    expect(screen.getAllByDisplayValue("0812 9999 0000")).toHaveLength(2);
  });

  test("associates cart labels with unique stable item controls and supports keyboard radios", async () => {
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

    expect(await screen.findByText("QRIS")).toBeInTheDocument();
    expect(screen.getByLabelText("Nama Lengkap")).toHaveAttribute(
      "id",
      "cart-customer-name"
    );
    expect(screen.getByLabelText("Email", { selector: "#cart-customer-email" })).toHaveAttribute(
      "id",
      "cart-customer-email"
    );
    expect(screen.getByLabelText("WhatsApp", { selector: "#cart-customer-phone" })).toHaveAttribute(
      "id",
      "cart-customer-phone"
    );

    const recipientNames = screen.getAllByLabelText("Nama Penerima");
    const senderMessages = screen.getAllByLabelText("Pesan untuk Penerima");
    const recipientPhones = screen.getAllByLabelText("WhatsApp Penerima");
    expect(recipientNames).toHaveLength(2);
    expect(senderMessages).toHaveLength(2);
    expect(recipientPhones).toHaveLength(2);

    const repeatedIds = [
      ...recipientNames,
      ...senderMessages,
      ...recipientPhones,
    ].map((control) => control.id);
    expect(new Set(repeatedIds).size).toBe(repeatedIds.length);
    expect(repeatedIds.every((id) => id.startsWith("cart-voucher-"))).toBe(true);
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

    const secondRecipientRadio = screen.getAllByRole("radio", { name: "Saya" })[1];
    const secondRecipientCard = secondRecipientRadio.closest("label");
    expect(secondRecipientCard).toHaveAttribute("for", secondRecipientRadio.id);
    expect(secondRecipientCard?.className).toMatch(
      /\bfocus(?:-visible|-within)?:/
    );

    secondRecipientRadio.focus();
    await user.keyboard("[Space]");
    expect(secondRecipientRadio).toBeChecked();

    const firstEmailDelivery = screen.getAllByRole("radio", { name: "Email" })[0];
    firstEmailDelivery.focus();
    await user.keyboard("[Space]");
    expect(firstEmailDelivery).toBeChecked();
    expect(await screen.findAllByLabelText("Email Penerima")).toHaveLength(1);

    const vaPayment = screen.getByRole("radio", { name: /^Virtual Account/ });
    expect(vaPayment).toHaveAttribute("id", "cart-payment-va");
    await user.click(vaPayment);
    expect(screen.getByLabelText("Bank Virtual Account")).toHaveAttribute(
      "id",
      "cart-va-bank"
    );

    await user.click(screen.getAllByRole("button", { name: "Lanjut ke Pembayaran" })[0]);

    const firstRecipientName = recipientNames[0];
    await waitFor(() =>
      expect(firstRecipientName).toHaveAttribute("aria-invalid", "true")
    );
    expect(firstRecipientName).toHaveAttribute(
      "aria-describedby",
      `${firstRecipientName.id}-error`
    );
    expect(document.getElementById(`${firstRecipientName.id}-error`)).toHaveTextContent(
      "Nama penerima wajib diisi"
    );
    expect(screen.getByLabelText("Nama Lengkap")).toHaveFocus();
  });

  test("keeps cart items and starts a recoverable pending checkout", async () => {
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

    expect(await screen.findByText("QRIS")).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText("Gunakan penerima yang sama"));
    expect(screen.getAllByText("Mengikuti Voucher 1").length).toBeGreaterThan(0);

    fireEvent.change(screen.getByPlaceholderText("Nama penerima voucher"), {
      target: { value: "Penerima Utama" },
    });

    const phoneInput = screen.getAllByPlaceholderText("+62 812 3456 7890")[1];
    fireEvent.change(phoneInput, {
      target: { value: "0812 3456 7890" },
    });

    await waitFor(() => {
      expect(screen.getByText("Penerima Utama")).toBeInTheDocument();
      expect(screen.getByText("0812 3456 7890")).toBeInTheDocument();
    });

    fireEvent.change(screen.getByPlaceholderText("Nama kamu"), {
      target: { value: "Faiz" },
    });
    fireEvent.change(screen.getByPlaceholderText("nama@email.com"), {
      target: { value: "faiz@example.com" },
    });
    fireEvent.change(screen.getAllByPlaceholderText("+62 812 3456 7890")[0], {
      target: { value: "0812 7777 1111" },
    });

    fireEvent.click(screen.getAllByRole("button", { name: "Lanjut ke Pembayaran" })[0]);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    const createPaymentCall = fetchMock.mock.calls[0];
    const requestBody = JSON.parse(createPaymentCall?.[1]?.body as string) as {
      lineItems: Array<{ recipientName: string; recipientPhone?: string }>;
    };

    expect(requestBody.lineItems).toEqual([
      expect.objectContaining({
        recipientName: "Penerima Utama",
        recipientPhone: "0812 3456 7890",
      }),
      expect.objectContaining({
        recipientName: "Penerima Utama",
        recipientPhone: "0812 3456 7890",
      }),
    ]);

    await waitFor(() => {
      expect(push).toHaveBeenCalledWith(
        "/checkout/success?order_id=KSP-123&status_session_id=status-session-1"
      );
    });

    expect(useCartStore.getState().items).toHaveLength(2);
    expect(useCartStore.getState().pendingCheckout).toEqual({
      paymentOrderId: "KSP-123",
      cartItemIds: ["cart-1", "cart-2"],
      createdAt: expect.any(Number),
    });
    expect(popup.close).toHaveBeenCalled();
  });
});
