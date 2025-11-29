/**
 * WhatsApp utility functions for Kalanara Spa Voucher delivery
 * @description Generates WhatsApp Web URLs for sending voucher messages
 */

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

  const message = `🎁 *KALANARA SPA GIFT VOUCHER*

Dear *${data.recipientName}*,

${data.senderName} has gifted you a luxurious spa experience at Kalanara Spa!
${data.senderMessage ? `\n_"${data.senderMessage}"_\n— ${data.senderName}\n` : ""}
━━━━━━━━━━━━━━━━━━
📋 *VOUCHER DETAILS*
━━━━━━━━━━━━━━━━━━

🎫 *Code:* \`${data.voucherCode}\`
💆 *Treatment:* ${data.serviceName}
⏱️ *Duration:* ${data.serviceDuration} minutes
💰 *Value:* ${formattedAmount}
📅 *Valid Until:* ${formattedExpiry}

━━━━━━━━━━━━━━━━━━
✨ *HOW TO REDEEM*
━━━━━━━━━━━━━━━━━━

1️⃣ Call us at +62 361 123 4567 to book
2️⃣ Present your voucher code on arrival
3️⃣ Enjoy your spa experience!

🔗 *Verify your voucher:*
${data.verifyUrl}

━━━━━━━━━━━━━━━━━━
*KALANARA SPA*
_Harmony in Every Touch_

📍 Jl. Raya Ubud No. 88, Ubud, Bali 80571
📞 +62 361 123 4567
✉️ hello@kalanaraspa.com`;

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
