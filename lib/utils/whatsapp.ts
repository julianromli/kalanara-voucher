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

  const message = `🎁 *You've got a gift!*

Hey ${data.recipientName}! ✨

${data.senderName} just sent you a spa treat at Kalanara Spa — lucky you!
${data.senderMessage ? `\n_"${data.senderMessage}"_\n— ${data.senderName} 💕\n` : ""}
• • •

*Your Voucher*
Code: \`${data.voucherCode}\`
Treatment: ${data.serviceName}
Duration: ${data.serviceDuration} min
Worth: ${formattedAmount}
Valid until: ${formattedExpiry}

• • •

*Ready to relax?*
📞 Book via +62 361 123 4567
📍 Show your code when you arrive
🔗 Verify: ${data.verifyUrl}

• • •

_Kalanara Spa_
Jl. Raya Ubud No. 88, Ubud, Bali
hello@kalanaraspa.com`;

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
