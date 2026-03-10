import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { ToastProvider } from "@/context/ToastContext";
import { CheckoutPageClient } from "@/app/checkout/[id]/checkout-page-client";
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

describe("CheckoutPageClient", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    push.mockReset();
    back.mockReset();
  });

  test("keeps recipient email field responsive while typing after email delivery is selected", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        config: {
          paymentNotice: null,
          paymentOptions: [{ code: "qris", label: "QRIS" }],
        },
      }),
    });

    vi.stubGlobal("fetch", fetchMock);

    render(
      <ToastProvider>
        <CheckoutPageClient service={service} />
      </ToastProvider>
    );

    expect(await screen.findByText("QRIS")).toBeInTheDocument();

    const emailDeliveryRadio = screen
      .getAllByRole("radio")
      .find((element) => (element as HTMLInputElement).value === "EMAIL");

    expect(emailDeliveryRadio).toBeTruthy();
    fireEvent.click(emailDeliveryRadio!);

    const recipientEmailInput = await screen.findByPlaceholderText("penerima@email.com");
    fireEvent.change(recipientEmailInput, {
      target: { value: "p" },
    });

    await waitFor(() => {
      expect(recipientEmailInput).toHaveValue("p");
    });
  });

  test("does not open the broken hosted Scalev page when the payment link is a public order URL", async () => {
    const popup = {
      close: vi.fn(),
      location: { href: "" },
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

    render(
      <ToastProvider>
        <CheckoutPageClient service={service} />
      </ToastProvider>
    );

    expect(await screen.findByText("QRIS")).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText("Nama kamu"), {
      target: { value: "Faiz" },
    });
    fireEvent.change(screen.getByPlaceholderText("nama@email.com"), {
      target: { value: "faiz@example.com" },
    });
    fireEvent.change(screen.getAllByPlaceholderText("+62 812 3456 7890")[0], {
      target: { value: "081234567890" },
    });
    fireEvent.change(screen.getByPlaceholderText("Nama penerima voucher"), {
      target: { value: "Penerima" },
    });
    fireEvent.change(screen.getAllByPlaceholderText("+62 812 3456 7890")[1], {
      target: { value: "081234567891" },
    });

    fireEvent.click(screen.getByRole("button", { name: "Lanjut ke Pembayaran" }));

    await waitFor(() => {
      expect(push).toHaveBeenCalledWith(
        "/checkout/success?order_id=KSP-123&token=public-token"
      );
    });

    expect(popup.close).toHaveBeenCalled();
    expect(popup.location.href).toBe("");
  });
});
