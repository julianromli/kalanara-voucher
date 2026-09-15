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
      return "Bayar dengan scan QRIS. Kode QR akan ditampilkan setelah pesanan dibuat.";
    case "va":
      return "Dapatkan nomor virtual account. Pilih bank setelah memilih metode ini.";
    case "invoice":
      return "Lanjut ke halaman pembayaran untuk menyelesaikan transaksi.";
    case "gopay":
    case "ovo":
    case "dana":
    case "shopeepay":
    case "linkaja":
      return "Kamu akan diarahkan ke halaman pembayaran / instruksi wallet.";
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
  const destination =
    sendTo === SendTo.RECIPIENT ? "penerima" : "kamu";
  const channel =
    deliveryMethod === DeliveryMethod.BOTH
      ? "email dan WhatsApp"
      : deliveryMethod === DeliveryMethod.EMAIL
        ? "email"
        : "WhatsApp";
  return `Voucher akan dikirim ke ${channel} ${destination} setelah pembayaran berhasil.`;
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
  return sendTo === SendTo.RECIPIENT ? "Penerima" : "Saya";
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
