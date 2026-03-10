/**
 * Voucher Service for Payment Gateway Integration
 * @description Handles voucher creation and delivery after successful payment
 */

import { createVoucher, getVoucherBySourceOrderId } from "@/lib/actions/vouchers";
import { updateOrderVoucherId } from "@/lib/actions/orders";
import type { OrderWithService, VoucherInsert } from "@/lib/database.types";

export interface VoucherCreationResult {
  success: boolean;
  voucherId?: string;
  voucherCode?: string;
  error?: string;
}

interface EffectiveDeliveryTarget {
  email: string | null;
  phone: string | null;
}

function calculateExpiryDate(): string {
  const expiryDate = new Date();
  expiryDate.setFullYear(expiryDate.getFullYear() + 1);
  return expiryDate.toISOString();
}

function getServerAppUrl(): string {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.trim();

  if (!appUrl) {
    throw new Error("Missing required environment variable: NEXT_PUBLIC_APP_URL");
  }

  return appUrl.replace(/\/+$/, "");
}

function getEffectiveDeliveryTarget(order: OrderWithService): EffectiveDeliveryTarget {
  if (order.send_to === "RECIPIENT") {
    return {
      email: order.recipient_email,
      phone: order.recipient_phone,
    };
  }

  return {
    email: order.customer_email,
    phone: order.customer_phone,
  };
}

export async function createVoucherOnPaymentSuccess(
  order: OrderWithService
): Promise<VoucherCreationResult> {
  const effectiveTarget = getEffectiveDeliveryTarget(order);

  // Validate required fields
  if (!order.service_id) {
    return { success: false, error: "Order missing service_id" };
  }
  if (!order.recipient_name) {
    return { success: false, error: "Order missing recipient_name" };
  }
  if (
    (order.delivery_method === "EMAIL" || order.delivery_method === "BOTH") &&
    !effectiveTarget.email
  ) {
    return { success: false, error: "Order missing effective email contact" };
  }
  if (
    (order.delivery_method === "WHATSAPP" || order.delivery_method === "BOTH") &&
    !effectiveTarget.phone
  ) {
    return { success: false, error: "Order missing effective WhatsApp contact" };
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
    const existingVoucher = await getVoucherBySourceOrderId(order.id);
    if (existingVoucher) {
      await updateOrderVoucherId(order.id, existingVoucher.id);

      return {
        success: true,
        voucherId: existingVoucher.id,
        voucherCode: existingVoucher.code,
        error: "Voucher already created",
      };
    }

    // Prepare voucher data
    const voucherData: Omit<VoucherInsert, "code"> = {
      source_order_id: order.id,
      service_id: order.service_id,
      recipient_name: order.recipient_name,
      recipient_email: effectiveTarget.email ?? order.customer_email,
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
  const { delivery_method } = order;
  const effectiveTarget = getEffectiveDeliveryTarget(order);

  const appUrl = getServerAppUrl();
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
    if (effectiveTarget.email) {
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
        console.log(`[VoucherService] Email sent to ${effectiveTarget.email}`);
      } catch (error) {
        console.error("[VoucherService] Email delivery failed:", error);
      }
    }
  }

  // Send via WhatsApp
  if (delivery_method === "WHATSAPP" || delivery_method === "BOTH") {
    if (effectiveTarget.phone) {
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
        console.log(`[VoucherService] WhatsApp sent to ${effectiveTarget.phone}`);
      } catch (error) {
        console.error("[VoucherService] WhatsApp delivery failed:", error);
      }
    }
  }
}
