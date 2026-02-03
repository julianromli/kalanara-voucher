/**
 * Mayar Webhook Handler
 * @description Handles payment notifications from Mayar
 *
 * This endpoint receives POST requests from Mayar when payment status changes.
 * It validates the payload, updates order status, and triggers voucher creation.
 *
 * @see https://docs.mayar.id/api-reference/webhook/history
 */

import { NextRequest, NextResponse } from "next/server";
import {
  isMayarWebhookPayload,
  isSuccessfulPayment,
  type MayarWebhookPayload,
  type PaymentGatewayData,
} from "@/lib/mayar/types";
import { getMayarConfig } from "@/lib/mayar/config";
import {
  getOrderByPaymentOrderId,
  getOrderByTransactionId,
  updateOrderPaymentStatus,
} from "@/lib/actions/orders";
import { createVoucherOnPaymentSuccess } from "@/lib/payment/voucher-service";

/**
 * Validate webhook authentication
 * Checks X-Webhook-Secret header against configured secret
 */
function validateWebhookAuth(request: NextRequest): boolean {
  const config = getMayarConfig();
  
  // If no webhook secret is configured, log warning but allow (for development)
  if (!config.webhookSecret) {
    console.warn("[Mayar Webhook] SECURITY WARNING: No MAYAR_WEBHOOK_SECRET configured. Webhook authentication disabled.");
    return true;
  }
  
  // Check for webhook secret in headers
  const providedSecret = request.headers.get("x-webhook-secret") 
    || request.headers.get("X-Webhook-Secret")
    || request.headers.get("authorization")?.replace("Bearer ", "");
  
  if (!providedSecret) {
    console.error("[Mayar Webhook] SECURITY: Missing webhook secret in request headers");
    return false;
  }
  
  if (providedSecret !== config.webhookSecret) {
    console.error("[Mayar Webhook] SECURITY: Invalid webhook secret provided");
    return false;
  }
  
  return true;
}

function extractOrderIdFromDescription(productName: string): string | null {
  // Try to extract from description pattern "Order: KSP-xxx"
  const descMatch = productName.match(/Order:\s*(KSP-[\w-]+)/i);
  if (descMatch) return descMatch[1];
  
  // Fallback: extract from anywhere in string (e.g., customer name)
  const anyMatch = productName.match(/(KSP-\d{13}-[A-Z0-9]{6})/i);
  return anyMatch ? anyMatch[1] : null;
}

export async function POST(request: NextRequest) {
  try {
    // Validate webhook authentication
    if (!validateWebhookAuth(request)) {
      console.error("[Mayar Webhook] SECURITY: Unauthorized webhook request rejected");
      return NextResponse.json(
        { status: "error", message: "Unauthorized" },
        { status: 401 }
      );
    }

    // Parse JSON body
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      console.error("[Mayar Webhook] Invalid JSON body");
      return NextResponse.json(
        { status: "error", message: "Invalid JSON" },
        { status: 400 }
      );
    }

    // Validate webhook payload structure
    if (!isMayarWebhookPayload(body)) {
      console.error("[Mayar Webhook] Invalid payload structure:", body);
      // Return 200 to prevent retries for malformed requests
      return NextResponse.json({
        status: "ok",
        message: "Invalid payload structure",
      });
    }

    const payload = body as MayarWebhookPayload;
    const { event, data } = payload;

    console.log(
      `[Mayar Webhook] Received ${event} for transaction ${data.transactionId}`
    );

    // Only process payment.received events
    if (event !== "payment.received") {
      console.log(`[Mayar Webhook] Ignoring event type: ${event}`);
      return NextResponse.json({ status: "ok", message: "Event ignored" });
    }

    // Validate payment status
    if (!isSuccessfulPayment(data)) {
      console.log(
        `[Mayar Webhook] Payment not successful: status=${data.status}, transactionStatus=${data.transactionStatus}`
      );
      return NextResponse.json({ status: "ok", message: "Payment not successful" });
    }

    // Extract order ID from product name/description or customer name
    let orderId = extractOrderIdFromDescription(data.productName);
    
    // Fallback: try extracting from customerName
    if (!orderId && data.customerName) {
      orderId = extractOrderIdFromDescription(data.customerName);
    }
    
    let order;

    if (orderId) {
      console.log(`[Mayar Webhook] Processing order by ID: ${orderId}`);
      order = await getOrderByPaymentOrderId(orderId);
    }

    // Secondary Fallback: try finding order by Mayar transaction ID if we already stored it
    // This happens if the user visited the redirect URL first, which updates the order with transaction ID
    if (!order && data.transactionId) {
      console.log(`[Mayar Webhook] Order ID not found in payload, trying lookup by transaction ID: ${data.transactionId}`);
      order = await getOrderByTransactionId(data.transactionId);
      if (order) {
        orderId = order.payment_order_id;
        console.log(`[Mayar Webhook] Found order via transaction ID: ${orderId}`);
      }
    }

    if (!order) {
      console.warn(
        `[Mayar Webhook] Could not match payment to any order. OrderID: ${orderId}, TransactionID: ${data.transactionId}`
      );
      // Still return 200 ok to Mayar so they stop retrying, but log the error
      return NextResponse.json({ status: "ok", message: "Order not found" });
    }

    // Idempotency check: skip if already in final state
    if (
      order.payment_status === "COMPLETED" ||
      order.payment_status === "REFUNDED"
    ) {
      console.log(
        `[Mayar Webhook] Order ${order.id} already in final state: ${order.payment_status}`
      );
      return NextResponse.json({ status: "ok", message: "Already processed" });
    }

    // Prepare payment data for storage
    const paymentData: PaymentGatewayData = {
      transaction_id: data.transactionId,
      payment_type: data.paymentMethod || "unknown",
      transaction_time: data.updatedAt || new Date().toISOString(),
    };

    // Update order status
    const updateSuccess = await updateOrderPaymentStatus(
      order.id,
      "COMPLETED",
      paymentData
    );
    if (!updateSuccess) {
      console.error(`[Mayar Webhook] Failed to update order ${order.id}`);
      return NextResponse.json(
        { status: "error", message: "Failed to update order" },
        { status: 500 }
      );
    }

    // Create voucher and trigger delivery
    console.log(
      `[Mayar Webhook] Payment successful for order ${order.id}, creating voucher...`
    );

    try {
      const voucherResult = await createVoucherOnPaymentSuccess(order);
      if (voucherResult.success) {
        console.log(`[Mayar Webhook] Voucher created: ${voucherResult.voucherId}`);
      } else {
        console.error(
          `[Mayar Webhook] Voucher creation failed: ${voucherResult.error}`
        );
        // Don't fail the webhook - order is already marked as completed
      }
    } catch (error) {
      console.error(`[Mayar Webhook] Voucher creation error:`, error);
      // Don't fail the webhook
    }

    console.log(`[Mayar Webhook] Successfully processed order ${orderId}`);
    return NextResponse.json({ status: "ok", message: "Notification processed" });
  } catch (error) {
    console.error("[Mayar Webhook] Unexpected error:", error);
    return NextResponse.json(
      { status: "error", message: "Internal server error" },
      { status: 500 }
    );
  }
}
