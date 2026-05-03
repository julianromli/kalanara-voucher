import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { CartCheckoutClient } from "@/app/checkout/cart/cart-checkout-client";
import { ToastProvider } from "@/context/ToastContext";
import { useCartStore } from "@/store/cart-store";

const push = vi.fn();
const back = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push,
    back,
  }),
}));

function renderCheckout() {
  render(
    <ToastProvider>
      <CartCheckoutClient />
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

  test("collapses secondary vouchers into summaries and restores editable fields on toggle off", async () => {
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
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    const createPaymentCall = fetchMock.mock.calls[1];
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
        "/checkout/success?order_id=KSP-123&token=public-token"
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
