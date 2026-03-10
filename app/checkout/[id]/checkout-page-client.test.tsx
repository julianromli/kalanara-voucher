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
});
