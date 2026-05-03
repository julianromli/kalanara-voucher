/**
 * Voucher Service for Payment Gateway Integration
 * @description Handles voucher creation and delivery after successful payment
 */

import {
  getOrderItemsByOrderId,
  updateOrderItemVoucherId,
  updateOrderVoucherId,
} from "@/lib/actions/orders";
import { createVoucher, getVoucherBySourceOrderId } from "@/lib/actions/vouchers";
import { sendVoucherEmail, sendVoucherWhatsApp } from "@/lib/payment/public-voucher-delivery";
import type {
  OrderItemWithService,
  OrderWithService,
  Voucher,
  VoucherInsert,
} from "@/lib/database.types";

export interface VoucherCreationResult {
  success: boolean;
  voucherId?: string;
  voucherCode?: string;
  voucherCount?: number;
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

function getEffectiveDeliveryTarget(
  order: OrderWithService,
  item?: OrderItemWithService
): EffectiveDeliveryTarget {
  const sendTo = item?.send_to ?? order.send_to;
  if (sendTo === "RECIPIENT") {
    return {
      email: item?.recipient_email ?? order.recipient_email,
      phone: item?.recipient_phone ?? order.recipient_phone,
    };
  }

  return {
    email: order.customer_email,
    phone: order.customer_phone,
  };
}

function validateVoucherSource(
  order: OrderWithService,
  item?: OrderItemWithService
): string | null {
  const effectiveTarget = getEffectiveDeliveryTarget(order, item);
  const serviceId = item?.service_id ?? order.service_id;
  const recipientName = item?.recipient_name ?? order.recipient_name;
  const deliveryMethod = item?.delivery_method ?? order.delivery_method;

  if (!serviceId) return "Order missing service_id";
  if (!recipientName) return "Order missing recipient_name";
  if ((deliveryMethod === "EMAIL" || deliveryMethod === "BOTH") && !effectiveTarget.email) {
    return "Order missing effective email contact";
  }
  if ((deliveryMethod === "WHATSAPP" || deliveryMethod === "BOTH") && !effectiveTarget.phone) {
    return "Order missing effective WhatsApp contact";
  }

  return null;
}

async function createVoucherForOrderItem(
  order: OrderWithService,
  item: OrderItemWithService
): Promise<Voucher | null> {
  if (item.voucher_id && item.vouchers) {
    return item.vouchers;
  }

  const validationError = validateVoucherSource(order, item);
  if (validationError) {
    throw new Error(validationError);
  }

  const effectiveTarget = getEffectiveDeliveryTarget(order, item);
  const voucherData: Omit<VoucherInsert, "code"> = {
    source_order_id: null,
    service_id: item.service_id,
    recipient_name: item.recipient_name,
    recipient_email: effectiveTarget.email ?? order.customer_email,
    sender_name: order.customer_name,
    sender_message: item.sender_message,
    expiry_date: calculateExpiryDate(),
    amount: item.unit_price,
    is_redeemed: false,
  };

  const voucher = await createVoucher(voucherData);
  if (!voucher) {
    throw new Error("Failed to create voucher in database");
  }

  const linked = await updateOrderItemVoucherId(item.id, voucher.id);
  if (!linked) {
    throw new Error(`Failed to link voucher ${voucher.id} to order item ${item.id}`);
  }
  return voucher;
}

async function createSingleVoucher(order: OrderWithService): Promise<VoucherCreationResult> {
  const validationError = validateVoucherSource(order);
  if (validationError) {
    return { success: false, error: validationError };
  }

  if (order.voucher_id) {
    return {
      success: true,
      voucherId: order.voucher_id,
      voucherCount: 1,
      error: "Voucher already created",
    };
  }

  const existingVoucher = await getVoucherBySourceOrderId(order.id);
  if (existingVoucher) {
    await updateOrderVoucherId(order.id, existingVoucher.id);

    return {
      success: true,
      voucherId: existingVoucher.id,
      voucherCode: existingVoucher.code,
      voucherCount: 1,
      error: "Voucher already created",
    };
  }

  const effectiveTarget = getEffectiveDeliveryTarget(order);
  const voucherData: Omit<VoucherInsert, "code"> = {
    source_order_id: order.id,
    service_id: order.service_id as string,
    recipient_name: order.recipient_name as string,
    recipient_email: effectiveTarget.email ?? order.customer_email,
    sender_name: order.customer_name,
    sender_message: order.sender_message,
    expiry_date: calculateExpiryDate(),
    amount: order.total_amount,
    is_redeemed: false,
  };

  const voucher = await createVoucher(voucherData);
  if (!voucher) {
    return { success: false, error: "Failed to create voucher in database" };
  }

  const updateSuccess = await updateOrderVoucherId(order.id, voucher.id);
  if (!updateSuccess) {
    return {
      success: false,
      voucherId: voucher.id,
      voucherCode: voucher.code,
      error: "Failed to link voucher to order",
    };
  }

  return {
    success: true,
    voucherId: voucher.id,
    voucherCode: voucher.code,
    voucherCount: 1,
  };
}

async function triggerSingleVoucherDelivery(
  order: OrderWithService,
  item?: OrderItemWithService
): Promise<void> {
  if (!order.payment_order_id || !order.public_access_token) {
    console.error(`[VoucherService] Missing public access credentials for order ${order.id}`);
    return;
  }

  const deliveryMethod = item?.delivery_method ?? order.delivery_method;
  const itemId = item?.id;

  if (deliveryMethod === "EMAIL" || deliveryMethod === "BOTH") {
    await sendVoucherEmail(order.payment_order_id, order.public_access_token, itemId);
  }

  if (deliveryMethod === "WHATSAPP" || deliveryMethod === "BOTH") {
    await sendVoucherWhatsApp(order.payment_order_id, order.public_access_token, itemId);
  }
}

export async function createVoucherOnPaymentSuccess(
  order: OrderWithService
): Promise<VoucherCreationResult> {
  try {
    const orderItems = await getOrderItemsByOrderId(order.id);
    if (orderItems.length > 0) {
      const wasAlreadyFulfilled = orderItems.every((item) => item.voucher_id && item.vouchers);
      const createdVouchers = await Promise.all(
        orderItems.map((item) => createVoucherForOrderItem(order, item))
      );
      const firstVoucher = createdVouchers.find(Boolean);

      if (firstVoucher && !order.voucher_id) {
        await updateOrderVoucherId(order.id, firstVoucher.id);
      }

      if (!wasAlreadyFulfilled) {
        await Promise.all(orderItems.map((item) => triggerSingleVoucherDelivery(order, item)));
      }

      return {
        success: true,
        voucherId: firstVoucher?.id,
        voucherCode: firstVoucher?.code,
        voucherCount: createdVouchers.filter(Boolean).length,
      };
    }

    const wasAlreadyFulfilled = Boolean(order.voucher_id);
    const result = await createSingleVoucher(order);
    if (
      result.success &&
      result.error !== "Voucher already created" &&
      !wasAlreadyFulfilled
    ) {
      await triggerSingleVoucherDelivery(order);
    }

    return result;
  } catch (error) {
    console.error("[VoucherService] Error creating voucher:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}
