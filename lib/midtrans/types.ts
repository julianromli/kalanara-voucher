/**
 * Midtrans Payment Gateway Type Definitions
 * @description TypeScript interfaces for Midtrans Snap integration
 */

import type { DeliveryMethod, SendTo } from "@/lib/types";

// ============================================================================
// Midtrans Notification Types (Webhook)
// ============================================================================

/**
 * Notification payload sent by Midtrans webhook
 * @see https://docs.midtrans.com/docs/https-notification-webhooks
 */
export interface MidtransNotification {
  /** Transaction timestamp from Midtrans */
  readonly transaction_time: string;
  /** Current transaction status */
  readonly transaction_status: MidtransTransactionStatus;
  /** Unique transaction ID from Midtrans */
  readonly transaction_id: string;
  /** HTTP status code as string */
  readonly status_code: string;
  /** SHA512 signature for verification */
  readonly signature_key: string;
  /** Merchant's order ID */
  readonly order_id: string;
  /** Merchant ID */
  readonly merchant_id: string;
  /** Transaction amount as string (no decimals) */
  readonly gross_amount: string;
  /** Fraud detection status (for card payments) */
  readonly fraud_status?: MidtransFraudStatus;
  /** Payment method used */
  readonly payment_type: string;
  /** Status message */
  readonly status_message?: string;
}

/**
 * Possible transaction statuses from Midtrans
 */
export type MidtransTransactionStatus =
  | "capture"      // Card payment captured
  | "settlement"   // Payment settled
  | "pending"      // Waiting for payment
  | "deny"         // Payment denied
  | "cancel"       // Payment cancelled
  | "expire"       // Payment expired
  | "refund"       // Payment refunded
  | "partial_refund"; // Partial refund

/**
 * Fraud detection status for card payments
 */
export type MidtransFraudStatus = "accept" | "challenge" | "deny";

// ============================================================================
// Snap Types
// ============================================================================

/**
 * Result object returned by Snap.js callbacks
 */
export interface SnapResult {
  /** Transaction status */
  readonly status_code: string;
  /** Status message */
  readonly status_message: string;
  /** Transaction ID from Midtrans */
  readonly transaction_id: string;
  /** Merchant's order ID */
  readonly order_id: string;
  /** Transaction amount */
  readonly gross_amount: string;
  /** Payment method used */
  readonly payment_type: string;
  /** Transaction timestamp */
  readonly transaction_time: string;
  /** Transaction status */
  readonly transaction_status: MidtransTransactionStatus;
  /** Fraud status (for card payments) */
  readonly fraud_status?: MidtransFraudStatus;
  /** PDF URL for payment instructions (bank transfer) */
  readonly pdf_url?: string;
  /** Finish redirect URL */
  readonly finish_redirect_url?: string;
}

// ============================================================================
// Transaction Request Types
// ============================================================================

/**
 * Customer details for Midtrans transaction
 */
export interface MidtransCustomerDetails {
  readonly first_name: string;
  readonly last_name?: string;
  readonly email: string;
  readonly phone: string;
}

/**
 * Item details for Midtrans transaction
 */
export interface MidtransItemDetails {
  readonly id: string;
  readonly name: string;
  readonly price: number;
  readonly quantity: number;
}

/**
 * Transaction details for creating Snap token
 */
export interface MidtransTransactionDetails {
  readonly order_id: string;
  readonly gross_amount: number;
}

/**
 * Full transaction request payload for Snap API
 */
export interface MidtransTransactionRequest {
  readonly transaction_details: MidtransTransactionDetails;
  readonly customer_details: MidtransCustomerDetails;
  readonly item_details?: MidtransItemDetails[];
  readonly callbacks?: {
    readonly finish?: string;
  };
}

// ============================================================================
// API Request/Response Types
// ============================================================================

/**
 * Request body for create-transaction API endpoint
 */
export interface CreateTransactionRequest {
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

/**
 * Response from create-transaction API endpoint
 */
export interface CreateTransactionResponse {
  readonly success: boolean;
  readonly token?: string;
  readonly orderId?: string;
  readonly error?: string;
}

// ============================================================================
// Snap API Response Types
// ============================================================================

/**
 * Response from Midtrans Snap API when creating transaction token
 */
export interface SnapTokenResponse {
  readonly token: string;
  readonly redirect_url: string;
}

/**
 * Error response from Midtrans API
 */
export interface MidtransErrorResponse {
  readonly status_code: string;
  readonly status_message: string;
  readonly error_messages?: string[];
}

// ============================================================================
// Internal Types for Order Processing
// ============================================================================

/**
 * Data required to create a pending order before payment
 */
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

/**
 * Midtrans-specific data to store with order after webhook
 */
export interface MidtransPaymentData {
  readonly transaction_id: string;
  readonly payment_type: string;
  readonly transaction_time: string;
}

// ============================================================================
// Type Guards
// ============================================================================

/**
 * Type guard to check if a value is a valid MidtransNotification
 */
export function isMidtransNotification(value: unknown): value is MidtransNotification {
  if (typeof value !== "object" || value === null) return false;
  
  const obj = value as Record<string, unknown>;
  
  return (
    typeof obj.transaction_status === "string" &&
    typeof obj.transaction_id === "string" &&
    typeof obj.status_code === "string" &&
    typeof obj.signature_key === "string" &&
    typeof obj.order_id === "string" &&
    typeof obj.gross_amount === "string" &&
    typeof obj.payment_type === "string"
  );
}

/**
 * Check if transaction status indicates successful payment
 */
export function isSuccessfulPayment(
  status: MidtransTransactionStatus,
  fraudStatus?: MidtransFraudStatus
): boolean {
  if (status === "settlement") return true;
  if (status === "capture" && fraudStatus === "accept") return true;
  return false;
}

/**
 * Check if transaction status indicates failed payment
 */
export function isFailedPayment(status: MidtransTransactionStatus): boolean {
  return status === "deny" || status === "cancel" || status === "expire";
}

/**
 * Check if transaction status indicates pending payment
 */
export function isPendingPayment(status: MidtransTransactionStatus): boolean {
  return status === "pending";
}
