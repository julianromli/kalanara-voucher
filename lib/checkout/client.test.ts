import { describe, expect, test } from "vitest";
import {
  buildCheckoutLineItem,
  cleanOptionalText,
  getContactVisibility,
  getDeliveryPreview,
  getSuccessDeliveryCopy,
  getPaymentMethodDescription,
  normalizePhoneInput,
  resolveCheckoutRecipientName,
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
    expect(
      getDeliveryPreview(SendTo.RECIPIENT, DeliveryMethod.BOTH)
    ).toBe(
      "Voucher akan dikirim ke email penerima setelah pembayaran berhasil. Setelah bayar, kamu bisa kirim pesan WhatsApp-nya dengan satu tap."
    );
    expect(
      getDeliveryPreview(SendTo.RECIPIENT, DeliveryMethod.WHATSAPP)
    ).toBe("Setelah bayar, kamu bisa kirim pesan WhatsApp-nya dengan satu tap.");
  });

  test("success copy never claims WhatsApp was sent", () => {
    expect(
      getSuccessDeliveryCopy(
        { sendTo: SendTo.PURCHASER, deliveryMethod: DeliveryMethod.EMAIL, emailStatus: "SENT" },
        "tri@example.com"
      )
    ).toEqual({ email: "Voucher dikirim ke email tri@example.com.", whatsapp: null });
    expect(
      getSuccessDeliveryCopy(
        { sendTo: SendTo.PURCHASER, deliveryMethod: DeliveryMethod.EMAIL },
        "tri@example.com"
      ).email
    ).toBe("Voucher sedang dikirim ke email tri@example.com.");
    expect(
      getSuccessDeliveryCopy({
        sendTo: SendTo.RECIPIENT,
        deliveryMethod: DeliveryMethod.BOTH,
        recipientEmail: "dias@example.com",
        recipientName: "Dias",
        whatsappLink: "https://wa.me/628123?text=x",
        emailStatus: "SENT",
      })
    ).toEqual({
      email: "Voucher dikirim ke email dias@example.com.",
      whatsapp:
        "WhatsApp tidak terkirim otomatis. Tap tombol di bawah untuk mengirim voucher ke Dias dari WhatsApp kamu.",
    });
    expect(
      getSuccessDeliveryCopy({ sendTo: SendTo.PURCHASER, deliveryMethod: DeliveryMethod.WHATSAPP }).whatsapp
    ).toBe("Link WhatsApp belum siap. Cek lagi sebentar.");
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
    expect(getPaymentMethodDescription("qris")).toMatch(/Scan QR/);
    expect(getPaymentMethodDescription("va")).toMatch(/virtual account/);
    expect(getPaymentMethodDescription("gopay")).toMatch(/aplikasi dompet/);
  });

  test("uses the buyer name when a self voucher name is blank", () => {
    expect(
      resolveCheckoutRecipientName("", "  Sari ", SendTo.PURCHASER)
    ).toBe("Sari");
    expect(
      resolveCheckoutRecipientName("Ibu Ani", "Sari", SendTo.PURCHASER)
    ).toBe("Ibu Ani");
    expect(
      resolveCheckoutRecipientName("  ", "Sari", SendTo.RECIPIENT)
    ).toBe("");
  });
});
