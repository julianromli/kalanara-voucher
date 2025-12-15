/**
 * Midtrans Signature Verification
 * @description SHA512 signature computation and verification for webhook notifications
 * 
 * Signature formula: SHA512(order_id + status_code + gross_amount + ServerKey)
 * @see https://docs.midtrans.com/docs/https-notification-webhooks#signature-key
 */

import { createHash } from "crypto";
import type { MidtransNotification } from "./types";

/**
 * Compute SHA512 signature for Midtrans notification verification
 * 
 * @param orderId - The order ID from the notification
 * @param statusCode - The status code from the notification
 * @param grossAmount - The gross amount from the notification (as string)
 * @param serverKey - The Midtrans server key
 * @returns SHA512 hash as lowercase hex string
 */
export function computeSignature(
  orderId: string,
  statusCode: string,
  grossAmount: string,
  serverKey: string
): string {
  const payload = orderId + statusCode + grossAmount + serverKey;
  return createHash("sha512").update(payload).digest("hex");
}

/**
 * Verify the signature of a Midtrans notification
 * 
 * @param notification - The notification payload from Midtrans
 * @param serverKey - The Midtrans server key
 * @returns true if signature is valid, false otherwise
 */
export function verifySignature(
  notification: Pick<MidtransNotification, "order_id" | "status_code" | "gross_amount" | "signature_key">,
  serverKey: string
): boolean {
  const expectedSignature = computeSignature(
    notification.order_id,
    notification.status_code,
    notification.gross_amount,
    serverKey
  );
  
  // Use timing-safe comparison to prevent timing attacks
  return timingSafeEqual(expectedSignature, notification.signature_key);
}

/**
 * Timing-safe string comparison to prevent timing attacks
 * 
 * @param a - First string
 * @param b - Second string
 * @returns true if strings are equal, false otherwise
 */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }
  
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  
  return result === 0;
}
