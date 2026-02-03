/**
 * Mayar Payment Gateway Type Definitions
 * @description TypeScript interfaces for Mayar.id integration
 */

import type { DeliveryMethod, SendTo } from "@/lib/types";

// ============================================================================
// Mayar API Request/Response Types
// ============================================================================

/**
 * Request body for Mayar create payment API
 * @see https://docs.mayar.id/api-reference/reqpayment/create
 */
export interface MayarCreatePaymentRequest {
  readonly name: string;
  readonly email: string;
  readonly amount: number;
  readonly mobile: string;
  readonly redirectUrl: string;
  readonly description: string;
  readonly expiredAt: string;
}

/**
 * Response from Mayar create payment API
 */
export interface MayarCreatePaymentResponse {
  readonly statusCode: number;
  readonly messages: string;
  readonly data: {
    readonly id: string;
    readonly transactionId: string;
    readonly link: string;
  };
}

// ============================================================================
// Webhook Types
// ============================================================================

export type MayarWebhookEvent = "payment.received" | "payment.reminder";

export type MayarPaymentStatus = "SUCCESS" | "PENDING" | "FAILED";

export type MayarTransactionStatus = "paid" | "created" | "expired";

/**
 * Webhook payload from Mayar
 * @see https://docs.mayar.id/api-reference/webhook/history
 */
export interface MayarWebhookPayload {
  readonly event: MayarWebhookEvent;
  readonly data: MayarWebhookData;
}

export interface MayarWebhookData {
  readonly id: string;
  readonly transactionId: string;
  readonly status: MayarPaymentStatus;
  readonly transactionStatus: MayarTransactionStatus;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly merchantId: string;
  readonly merchantName?: string;
  readonly merchantEmail: string;
  readonly customerName: string;
  readonly customerEmail: string;
  readonly customerMobile: string;
  readonly amount: number;
  readonly isAdminFeeBorneByCustomer?: boolean | null;
  readonly isChannelFeeBorneByCustomer?: boolean | null;
  readonly productId: string;
  readonly productName: string;
  readonly productType: string;
  readonly qty: number;
  readonly couponUsed?: string | null;
  readonly paymentMethod?: string | null;
  readonly paymentUrl?: string;
  readonly nettAmount?: number;
}

// ============================================================================
// Internal API Types
// ============================================================================

export interface CreatePaymentRequest {
  readonly serviceId: string;
  readonly customerName: string;
  readonly customerEmail: string;
  readonly customerPhone: string;
  readonly recipientName: string;
  readonly recipientEmail?: string;
  readonly recipientPhone: string;
  readonly senderMessage?: string;
  readonly deliveryMethod: DeliveryMethod;
  readonly sendTo: SendTo;
}

export interface CreatePaymentResponse {
  readonly success: boolean;
  readonly paymentLink?: string;
  readonly orderId?: string;
  readonly error?: string;
}

export interface PendingOrderData {
  readonly service_id: string;
  readonly customer_email: string;
  readonly customer_name: string;
  readonly customer_phone: string;
  readonly recipient_name: string;
  readonly recipient_email?: string;
  readonly recipient_phone: string;
  readonly sender_message?: string;
  readonly delivery_method: DeliveryMethod;
  readonly send_to: SendTo;
  readonly total_amount: number;
}

export interface PaymentGatewayData {
  readonly transaction_id: string;
  readonly payment_type: string;
  readonly transaction_time: string;
}

// ============================================================================
// Type Guards
// ============================================================================

export function isMayarWebhookPayload(
  value: unknown
): value is MayarWebhookPayload {
  if (typeof value !== "object" || value === null) return false;

  const obj = value as Record<string, unknown>;

  // Validate event field
  if (
    typeof obj.event !== "string" ||
    (obj.event !== "payment.received" && obj.event !== "payment.reminder")
  ) {
    return false;
  }

  // Validate data object exists
  if (typeof obj.data !== "object" || obj.data === null) {
    return false;
  }

  const data = obj.data as Record<string, unknown>;

  // Validate critical data fields for payment processing
  if (typeof data.transactionId !== "string" || data.transactionId === "") {
    return false;
  }

  if (typeof data.status !== "string" || data.status === "") {
    return false;
  }

  if (typeof data.productName !== "string") {
    return false;
  }

  return true;
}

export function isSuccessfulPayment(data: MayarWebhookData): boolean {
  // Accept both "paid" (production) and "created" (sandbox) as successful
  return data.status === "SUCCESS" && (data.transactionStatus === "paid" || data.transactionStatus === "created");
}
