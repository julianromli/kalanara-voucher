import type {
  ScalevCheckoutLineItem,
  ScalevPaymentMethod,
} from "@/lib/scalev/types";
import { DeliveryMethod, SendTo } from "@/lib/types";

export const PHONE_PATTERN = /^(\+62|62|0)[\d\s-]{8,14}$/;

export function normalizePhoneInput(value: string) {
  return value.replace(/[()-]/g, " ").replace(/\s+/g, " ").trim();
}

export function cleanOptionalText(value?: string) {
  const normalized = value?.trim();
  return normalized || undefined;
}

export function getPaymentMethodDescription(code: ScalevPaymentMethod) {
  switch (code) {
    case "qris":
      return "Scan QR setelah pesanan dibuat.";
    case "va":
      return "Pilih bank, lalu bayar ke nomor virtual account.";
    case "invoice":
      return "Lanjut ke halaman pembayaran.";
    case "gopay":
    case "ovo":
    case "dana":
    case "shopeepay":
    case "linkaja":
      return "Kamu diarahkan ke aplikasi dompet.";
    default:
      return "Pembayaran diproses melalui Scalev.";
  }
}

export function getContactVisibility(
  sendTo: SendTo,
  deliveryMethod: DeliveryMethod
) {
  const isRecipient = sendTo === SendTo.RECIPIENT;
  return {
    showRecipientPhone:
      isRecipient &&
      (deliveryMethod === DeliveryMethod.WHATSAPP ||
        deliveryMethod === DeliveryMethod.BOTH),
    showRecipientEmail:
      isRecipient &&
      (deliveryMethod === DeliveryMethod.EMAIL ||
        deliveryMethod === DeliveryMethod.BOTH),
  };
}

export function getDeliveryPreview(
  sendTo: SendTo,
  deliveryMethod: DeliveryMethod
) {
  const destination = sendTo === SendTo.RECIPIENT ? "penerima" : "kamu";
  const whatsAppStep =
    "Setelah bayar, kamu bisa kirim pesan WhatsApp-nya dengan satu tap.";
  if (deliveryMethod === DeliveryMethod.WHATSAPP) {
    return whatsAppStep;
  }
  const emailLine = `Voucher akan dikirim ke email ${destination} setelah pembayaran berhasil.`;
  return deliveryMethod === DeliveryMethod.BOTH
    ? `${emailLine} ${whatsAppStep}`
    : emailLine;
}

export interface SuccessDeliveryCopy {
  email: string | null;
  whatsapp: string | null;
}

/**
 * What the success page can honestly say: email goes out automatically,
 * WhatsApp is never sent for the buyer, it is a wa.me message they tap to send.
 */
export function getSuccessDeliveryCopy(voucher: {
  sendTo: SendTo;
  deliveryMethod: DeliveryMethod;
  recipientEmail?: string | null;
  recipientName?: string;
  whatsappLink?: string | null;
}, customerEmail?: string | null): SuccessDeliveryCopy {
  const forRecipient = voucher.sendTo === SendTo.RECIPIENT;
  const usesEmail =
    voucher.deliveryMethod === DeliveryMethod.EMAIL ||
    voucher.deliveryMethod === DeliveryMethod.BOTH;
  const usesWhatsApp =
    voucher.deliveryMethod === DeliveryMethod.WHATSAPP ||
    voucher.deliveryMethod === DeliveryMethod.BOTH;

  let email: string | null = null;
  if (usesEmail) {
    const address = forRecipient ? voucher.recipientEmail : customerEmail;
    email = address
      ? `Voucher dikirim ke email ${address}.`
      : forRecipient
        ? "Voucher dikirim ke email penerima."
        : "Voucher dikirim ke email kamu.";
  } else if (usesWhatsApp) {
    email = "Voucher tidak dikirim lewat email. Simpan PDF-nya atau kirim lewat WhatsApp.";
  }

  let whatsapp: string | null = null;
  if (usesWhatsApp) {
    const target = forRecipient ? voucher.recipientName || "penerima" : "nomor kamu";
    whatsapp = voucher.whatsappLink
      ? `WhatsApp tidak terkirim otomatis. Tap tombol di bawah untuk mengirim voucher ke ${target} dari WhatsApp kamu.`
      : "Link WhatsApp belum siap. Cek lagi sebentar.";
  }

  return { email, whatsapp };
}

export function buildConditionalFieldAnnouncement(
  sendTo: SendTo,
  deliveryMethod: DeliveryMethod
) {
  if (sendTo === SendTo.PURCHASER) {
    return "Kontak penerima disembunyikan. Voucher akan dikirim ke kontak kamu.";
  }
  if (deliveryMethod === DeliveryMethod.WHATSAPP) {
    return "Field WhatsApp penerima wajib diisi.";
  }
  if (deliveryMethod === DeliveryMethod.EMAIL) {
    return "Field email penerima wajib diisi.";
  }
  return "Field email dan WhatsApp penerima wajib diisi.";
}

export function getSendToSummary(sendTo: SendTo) {
  return sendTo === SendTo.RECIPIENT ? "Untuk orang lain" : "Untuk saya";
}

export function resolveCheckoutRecipientName(
  recipientName: string,
  customerName: string,
  sendTo: SendTo
) {
  const printedName = recipientName.trim();
  if (printedName) {
    return printedName;
  }
  if (sendTo === SendTo.PURCHASER) {
    return customerName.trim();
  }
  return printedName;
}

export function getDeliveryMethodSummary(deliveryMethod: DeliveryMethod) {
  return deliveryMethod === DeliveryMethod.BOTH
    ? "Email & WhatsApp"
    : deliveryMethod === DeliveryMethod.EMAIL
      ? "Email"
      : "WhatsApp";
}

interface RecipientInput {
  serviceId: string;
  recipientName: string;
  recipientEmail?: string;
  recipientPhone?: string;
  senderMessage: string;
  sendTo: SendTo;
  deliveryMethod: DeliveryMethod;
}

export function buildCheckoutLineItem(
  item: RecipientInput
): ScalevCheckoutLineItem {
  const { showRecipientEmail, showRecipientPhone } = getContactVisibility(
    item.sendTo,
    item.deliveryMethod
  );
  return {
    serviceId: item.serviceId,
    recipientName: item.recipientName.trim(),
    recipientEmail: showRecipientEmail
      ? cleanOptionalText(item.recipientEmail)
      : undefined,
    recipientPhone: showRecipientPhone
      ? cleanOptionalText(normalizePhoneInput(item.recipientPhone ?? ""))
      : undefined,
    senderMessage: cleanOptionalText(item.senderMessage),
    deliveryMethod: item.deliveryMethod,
    sendTo: item.sendTo,
  };
}
