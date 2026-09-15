import { beforeEach, describe, expect, test, vi } from "vitest";
import {
  POPUP_BLOCKED_MESSAGE,
  submitCheckoutPayment,
} from "@/lib/checkout/payment-client";
import type { ScalevCheckoutRequest } from "@/lib/scalev/types";
import { DeliveryMethod, SendTo } from "@/lib/types";

const request: ScalevCheckoutRequest = {
  serviceId: "service-1",
  customerName: "Faiz",
  customerEmail: "faiz@example.com",
  customerPhone: "0812 3456 7890",
  recipientName: "Penerima",
  recipientPhone: "0812 1111 2222",
  deliveryMethod: DeliveryMethod.WHATSAPP,
  sendTo: SendTo.RECIPIENT,
  paymentMethod: "qris",
};

function successfulResponse(paymentLink: string) {
  return {
    ok: true,
    json: async () => ({
      success: true,
      paymentLink,
      paymentOrderId: "KSP-123",
      statusSessionId: "status-1",
    }),
  };
}

function createPopup() {
  return {
    close: vi.fn(),
    location: { href: "" },
    document: {
      open: vi.fn(),
      write: vi.fn(),
      close: vi.fn(),
    },
  };
}

describe("submitCheckoutPayment", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  test("closes the popup for a hosted public order URL", async () => {
    const popup = createPopup();
    vi.stubGlobal("open", vi.fn(() => popup as never));
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        successfulResponse("https://app.scalev.id/order/public/secret")
      )
    );

    await submitCheckoutPayment({
      request,
      onPopupBlocked: vi.fn(),
    });

    expect(popup.close).toHaveBeenCalledOnce();
    expect(popup.location.href).toBe("");
  });

  test("redirects the popup to an external payment URL", async () => {
    const popup = createPopup();
    vi.stubGlobal("open", vi.fn(() => popup as never));
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        successfulResponse("https://payments.example.com/session")
      )
    );

    await submitCheckoutPayment({
      request,
      onPopupBlocked: vi.fn(),
    });

    expect(popup.location.href).toBe(
      "https://payments.example.com/session"
    );
    expect(popup.close).not.toHaveBeenCalled();
  });

  test("reports a blocked popup for an external payment URL", async () => {
    const onPopupBlocked = vi.fn();
    vi.stubGlobal("open", vi.fn(() => null));
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        successfulResponse("https://payments.example.com/session")
      )
    );

    await submitCheckoutPayment({ request, onPopupBlocked });

    expect(onPopupBlocked).toHaveBeenCalledOnce();
    expect(POPUP_BLOCKED_MESSAGE).toMatch(/Popup pembayaran diblokir/);
  });

  test("closes the popup when payment creation fails", async () => {
    const popup = createPopup();
    vi.stubGlobal("open", vi.fn(() => popup as never));
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        json: async () => ({ success: false, error: "Gateway gagal." }),
      })
    );

    await expect(
      submitCheckoutPayment({
        request,
        onPopupBlocked: vi.fn(),
      })
    ).rejects.toThrow("Gateway gagal.");
    expect(popup.close).toHaveBeenCalledOnce();
  });
});
