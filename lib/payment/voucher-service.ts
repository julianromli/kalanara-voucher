/**
 * Voucher Service for Payment Gateway Integration
 * @description Handles voucher creation and delivery after successful payment
 */

import { createVoucher } from "@/lib/actions/vouchers";
import { updateOrderVoucherId } from "@/lib/actions/orders";
import type { OrderWithService, Voucher, VoucherInsert } from "@/lib/database.types";

export interface VoucherCreationResult {
  success: boolean;
  voucherId?: string;
  voucherCode?: string;
  error?: string;
}

function calculateExpiryDate(): string {
  const expiryDate = new Date();
  expiryDate.setFullYear(expiryDate.getFullYear() + 1);
  return expiryDate.toISOString();
}

export async function createVoucherOnPaymentSuccess(
  order: OrderWithService
): Promise<VoucherCreationResult> {
  // Validate required fields
  if (!order.service_id) {
    return { success: false, error: "Order missing service_id" };
  }
  if (!order.recipient_name) {
    return { success: false, error: "Order missing recipient_name" };
  }
  if (!order.recipient_email && !order.recipient_phone) {
    return { success: false, error: "Order missing recipient contact info" };
  }

  // Check if voucher already exists (idempotency)
  if (order.voucher_id) {
    return {
      success: true,
      voucherId: order.voucher_id,
      error: "Voucher already created",
    };
  }

  try {
    // Prepare voucher data
    const voucherData: Omit<VoucherInsert, "code"> = {
      service_id: order.service_id,
      recipient_name: order.recipient_name,
      recipient_email: order.recipient_email || order.customer_email,
      sender_name: order.customer_name,
      sender_message: order.sender_message,
      expiry_date: calculateExpiryDate(),
      amount: order.total_amount,
      is_redeemed: false,
    };

    // Create voucher
    const voucher = await createVoucher(voucherData);
    if (!voucher) {
      return { success: false, error: "Failed to create voucher in database" };
    }

    // Update order with voucher ID
    const updateSuccess = await updateOrderVoucherId(order.id, voucher.id);
    if (!updateSuccess) {
      console.error(`[VoucherService] Failed to update order ${order.id} with voucher ${voucher.id}`);
      // Don't fail - voucher was created successfully
    }

    // Trigger delivery based on order preferences
    await triggerVoucherDelivery(order);

    return {
      success: true,
      voucherId: voucher.id,
      voucherCode: voucher.code,
    };
  } catch (error) {
    console.error("[VoucherService] Error creating voucher:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

async function triggerVoucherDelivery(
  order: OrderWithService
): Promise<void> {
  const { delivery_method, send_to } = order;
  
  // Determine recipient contact info
  const recipientEmail = send_to === "RECIPIENT" 
    ? order.recipient_email 
    : order.customer_email;
  const recipientPhone = send_to === "RECIPIENT"
    ? order.recipient_phone
    : order.customer_phone;

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  if (!order.payment_order_id || !order.public_access_token) {
    console.error(`[VoucherService] Missing public access credentials for order ${order.id}`);
    return;
  }

  const deliveryPayload = {
    orderId: order.payment_order_id,
    token: order.public_access_token,
  };

  // Send via Email
  if (delivery_method === "EMAIL" || delivery_method === "BOTH") {
    if (recipientEmail) {
      try {
        const response = await fetch(`${appUrl}/api/email/send-voucher`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(deliveryPayload),
        });
        if (!response.ok) {
          const errorText = await response.text().catch(() => "");
          throw new Error(
            `Email delivery failed with status ${response.status}${
              errorText ? `: ${errorText}` : ""
            }`
          );
        }
        console.log(`[VoucherService] Email sent to ${recipientEmail}`);
      } catch (error) {
        console.error("[VoucherService] Email delivery failed:", error);
      }
    }
  }

  // Send via WhatsApp
  if (delivery_method === "WHATSAPP" || delivery_method === "BOTH") {
    if (recipientPhone) {
      try {
        const response = await fetch(`${appUrl}/api/whatsapp/send-voucher`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(deliveryPayload),
        });
        if (!response.ok) {
          const errorText = await response.text().catch(() => "");
          throw new Error(
            `WhatsApp delivery failed with status ${response.status}${
              errorText ? `: ${errorText}` : ""
            }`
          );
        }
        console.log(`[VoucherService] WhatsApp sent to ${recipientPhone}`);
      } catch (error) {
        console.error("[VoucherService] WhatsApp delivery failed:", error);
      }
    }
  }
}
