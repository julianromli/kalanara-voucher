/**
 * WhatsApp utility functions for Kalanara Spa Voucher delivery
 * @description Generates WhatsApp Web URLs for sending voucher messages
 */

import { APP_CONFIG } from "@/lib/constants";

export interface WhatsAppVoucherData {
  recipientPhone: string;
  recipientName: string;
  senderName: string;
  senderMessage?: string;
  voucherCode: string;
  serviceName: string;
  serviceDuration: number;
  amount: number;
  expiryDate: string;
  verifyUrl: string;
}

/**
 * Formats a phone number to international format for WhatsApp
 * Removes spaces, dashes, and ensures proper formatting
 */
export function formatPhoneNumber(phone: string): string {
  // Remove all non-digit characters except +
  let cleaned = phone.replace(/[^\d+]/g, "");

  // If starts with 0, replace with Indonesia country code
  if (cleaned.startsWith("0")) {
    cleaned = "62" + cleaned.slice(1);
  }

  // Remove leading + if present (WhatsApp URL doesn't need it)
  if (cleaned.startsWith("+")) {
    cleaned = cleaned.slice(1);
  }

  return cleaned;
}

/**
 * Formats currency in Indonesian Rupiah format
 */
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
  }).format(amount);
}

/**
 * Formats date to a readable format
 */
export function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

/**
 * Generates the voucher message for WhatsApp
 */
export function generateVoucherMessage(data: WhatsAppVoucherData): string {
  const formattedAmount = formatCurrency(data.amount);
  const formattedExpiry = formatDate(data.expiryDate);

  const message = `🎁 *Kado Spesial nih!* 

Halo ${data.recipientName}! 💕

${data.senderName} memberikanmu pengalaman spa yang menenangkan di Kalanara Spa Galaxy, Bekasi — selamat ya!
${data.senderMessage ? `\n💌 *"${data.senderMessage}"*\n— ${data.senderName} ✨\n` : ""}

━━━ ✨ Voucher Anda ✨ ━━━

Kode Voucher: \`${data.voucherCode}\`
Perawatan: ${data.serviceName}
Durasi: ${data.serviceDuration} menit
Nilai: ${formattedAmount}
Berlaku sampai: ${formattedExpiry}

━━━ *Siap untuk relaksasi?* ━━━

📞 Reservasi: ${APP_CONFIG.contact.phone}
📍 Tunjukkan kode saat tiba
🔗 Verifikasi: ${data.verifyUrl}

• • •

_Kalanara Spa Galaxy, Bekasi_
💆‍♀️ *Khusus Wanita* • Terapis Profesional
📧 hello@kalanaraspa.com

Terima kasih sudah mempercayakan waktu berkualitas Anda bersama kami! 🌸`;

  return message;
}

/**
 * Generates a WhatsApp Web URL with pre-filled message
 */
export function generateWhatsAppUrl(data: WhatsAppVoucherData): string {
  const formattedPhone = formatPhoneNumber(data.recipientPhone);
  const message = generateVoucherMessage(data);
  const encodedMessage = encodeURIComponent(message);

  return `https://wa.me/${formattedPhone}?text=${encodedMessage}`;
}
