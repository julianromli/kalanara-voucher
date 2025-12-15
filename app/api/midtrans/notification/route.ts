/**
 * Midtrans Webhook Notification Handler
 * @description Handles payment notifications from Midtrans
 * 
 * This endpoint receives POST requests from Midtrans when payment status changes.
 * It verifies the signature, updates order status, and triggers voucher creation on success.
 * 
 * @see https://docs.midtrans.com/docs/https-notification-webhooks
 */

import { NextRequest, NextResponse } from "next/server";
import { getMidtransConfig } from "@/lib/midtrans/config";
import { verifySignature } from "@/lib/midtrans/signature";
import {
  isMidtransNotification,
  isSuccessfulPayment,
  isFailedPayment,
  type MidtransNotification,
  type MidtransPaymentData,
} from "@/lib/midtrans/types";
import {
  getOrderByMidtransOrderId,
  updateOrderPaymentStatus,
} from "@/lib/actions/orders";
import { createVoucherOnPaymentSuccess } from "@/lib/midtrans/voucher-service";
import type { PaymentStatus } from "@/lib/database.types";

/**
 * Map Midtrans transaction status to internal PaymentStatus
 */
export function mapTransactionStatus(
  notification: MidtransNotification
): PaymentStatus {
  const { transaction_status, fraud_status } = notification;

  if (isSuccessfulPayment(transaction_status, fraud_status)) {
    return "COMPLETED";
  }

  if (isFailedPayment(transaction_status)) {
    return "FAILED";
  }

  // pending, challenge, or other statuses
  return "PENDING";
}


/**
 * Extract Midtrans payment data from notification
 */
function extractPaymentData(notification: MidtransNotification): MidtransPaymentData {
  return {
    transaction_id: notification.transaction_id,
    payment_type: notification.payment_type,
    transaction_time: notification.transaction_time,
  };
}

/**
 * POST /api/midtrans/notification
 * 
 * Webhook endpoint for Midtrans payment notifications.
 * Always returns HTTP 200 to prevent Midtrans from retrying (except for server errors).
 */
export async function POST(request: NextRequest) {
  try {
    // Parse JSON body
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      console.error("[Midtrans Webhook] Invalid JSON body");
      return NextResponse.json(
        { status: "error", message: "Invalid JSON" },
        { status: 400 }
      );
    }

    // Validate notification structure
    if (!isMidtransNotification(body)) {
      console.error("[Midtrans Webhook] Invalid notification structure:", body);
      // Return 200 to prevent retries for malformed requests
      return NextResponse.json({ status: "ok", message: "Invalid notification structure" });
    }

    const notification = body as MidtransNotification;
    const { order_id, transaction_status } = notification;

    console.log(`[Midtrans Webhook] Received notification for order ${order_id}: ${transaction_status}`);

    // Get Midtrans config for signature verification
    let config;
    try {
      config = getMidtransConfig();
    } catch (error) {
      console.error("[Midtrans Webhook] Configuration error:", error);
      return NextResponse.json(
        { status: "error", message: "Server configuration error" },
        { status: 500 }
      );
    }

    // Verify signature
    const isValidSignature = verifySignature(notification, config.serverKey);
    if (!isValidSignature) {
      console.error(`[Midtrans Webhook] Invalid signature for order ${order_id}`);
      // Return 200 to prevent retries, but log security event
      return NextResponse.json({ status: "ok", message: "Invalid signature" });
    }

    // Look up order by Midtrans order ID
    const order = await getOrderByMidtransOrderId(order_id);
    if (!order) {
      console.warn(`[Midtrans Webhook] Order not found: ${order_id}`);
      // Return 200 to prevent retries for non-existent orders
      return NextResponse.json({ status: "ok", message: "Order not found" });
    }

    // Map transaction status to payment status
    const newStatus = mapTransactionStatus(notification);
    const paymentData = extractPaymentData(notification);

    console.log(`[Midtrans Webhook] Updating order ${order.id} status: ${order.payment_status} -> ${newStatus}`);

    // Idempotency check: skip if already in final state
    if (order.payment_status === "COMPLETED" || order.payment_status === "REFUNDED") {
      console.log(`[Midtrans Webhook] Order ${order.id} already in final state: ${order.payment_status}`);
      return NextResponse.json({ status: "ok", message: "Already processed" });
    }

    // Skip if status hasn't changed (for PENDING -> PENDING)
    if (order.payment_status === newStatus && newStatus === "PENDING") {
      console.log(`[Midtrans Webhook] Order ${order.id} status unchanged: ${newStatus}`);
      return NextResponse.json({ status: "ok", message: "Status unchanged" });
    }

    // Update order status
    const updateSuccess = await updateOrderPaymentStatus(order.id, newStatus, paymentData);
    if (!updateSuccess) {
      console.error(`[Midtrans Webhook] Failed to update order ${order.id}`);
      return NextResponse.json(
        { status: "error", message: "Failed to update order" },
        { status: 500 }
      );
    }

    // If payment successful, create voucher and send delivery
    if (newStatus === "COMPLETED") {
      console.log(`[Midtrans Webhook] Payment successful for order ${order.id}, creating voucher...`);
      
      try {
        const voucherResult = await createVoucherOnPaymentSuccess(order);
        if (voucherResult.success) {
          console.log(`[Midtrans Webhook] Voucher created: ${voucherResult.voucherId}`);
        } else {
          console.error(`[Midtrans Webhook] Voucher creation failed: ${voucherResult.error}`);
          // Don't fail the webhook - order is already marked as completed
          // Admin can manually handle voucher creation if needed
        }
      } catch (error) {
        console.error(`[Midtrans Webhook] Voucher creation error:`, error);
        // Don't fail the webhook
      }
    }

    console.log(`[Midtrans Webhook] Successfully processed notification for order ${order_id}`);
    return NextResponse.json({ status: "ok", message: "Notification processed" });

  } catch (error) {
    console.error("[Midtrans Webhook] Unexpected error:", error);
    return NextResponse.json(
      { status: "error", message: "Internal server error" },
      { status: 500 }
    );
  }
}
