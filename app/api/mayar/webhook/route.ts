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
  // Try to extract from description pattern
  const match = productName.match(/Order:\s*(KSP-[\w-]+)/i);
  return match ? match[1] : null;
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

    // Extract order ID from product name/description
    const orderId = extractOrderIdFromDescription(data.productName);
    if (!orderId) {
      console.warn(
        `[Mayar Webhook] Could not extract order ID from: ${data.productName}`
      );
      return NextResponse.json({ status: "ok", message: "Order ID not found in description" });
    }

    console.log(`[Mayar Webhook] Processing order: ${orderId}`);

    // Look up order by payment order ID
    const order = await getOrderByPaymentOrderId(orderId);
    if (!order) {
      console.warn(`[Mayar Webhook] Order not found: ${orderId}`);
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
