import { describe, expect, test } from "vitest";
import {
  buildCheckoutLineItem,
  cleanOptionalText,
  getContactVisibility,
  getDeliveryPreview,
  getPaymentMethodDescription,
  normalizePhoneInput,
} from "@/lib/checkout/client";
import { DeliveryMethod, SendTo } from "@/lib/types";

describe("checkout client helpers", () => {
  test("normalizes phone and optional text inputs", () => {
    expect(normalizePhoneInput(" 0812-(3456)  7890 ")).toBe(
      "0812 3456 7890"
    );
    expect(cleanOptionalText("  pesan  ")).toBe("pesan");
    expect(cleanOptionalText("   ")).toBeUndefined();
  });

  test("derives recipient contact visibility and delivery copy", () => {
    expect(
      getContactVisibility(SendTo.RECIPIENT, DeliveryMethod.BOTH)
    ).toEqual({ showRecipientPhone: true, showRecipientEmail: true });
    expect(
      getContactVisibility(SendTo.PURCHASER, DeliveryMethod.BOTH)
    ).toEqual({ showRecipientPhone: false, showRecipientEmail: false });
    expect(
      getDeliveryPreview(SendTo.PURCHASER, DeliveryMethod.EMAIL)
    ).toBe(
      "Voucher akan dikirim ke email kamu setelah pembayaran berhasil."
    );
  });

  test("builds a line item without hidden recipient contacts", () => {
    expect(
      buildCheckoutLineItem({
        serviceId: "service-1",
        recipientName: " Penerima ",
        recipientEmail: "hidden@example.com",
        recipientPhone: "0812-3456-7890",
        senderMessage: "  Selamat!  ",
        sendTo: SendTo.PURCHASER,
        deliveryMethod: DeliveryMethod.BOTH,
      })
    ).toEqual({
      serviceId: "service-1",
      recipientName: "Penerima",
      recipientEmail: undefined,
      recipientPhone: undefined,
      senderMessage: "Selamat!",
      sendTo: SendTo.PURCHASER,
      deliveryMethod: DeliveryMethod.BOTH,
    });
  });

  test("keeps payment descriptions stable", () => {
    expect(getPaymentMethodDescription("qris")).toMatch(/scan QRIS/);
    expect(getPaymentMethodDescription("va")).toMatch(/virtual account/);
    expect(getPaymentMethodDescription("gopay")).toMatch(/instruksi wallet/);
  });
});
