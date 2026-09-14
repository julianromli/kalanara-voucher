/**
 * Voucher Service for Payment Gateway Integration
 * @description Handles voucher creation and delivery after successful payment
 */

import "server-only";

import {
  getOrderItemsByOrderId,
} from "@/lib/actions/orders";
import {
  updateOrderVoucherId,
} from "@/lib/payment/order-writes";
import {
  createVoucherForPaidOrder,
  createVoucherForPaidOrderItem,
} from "@/lib/payment/voucher-writes";
import {
  claimVoucherDeliveries,
  markVoucherDeliveryFailed,
  markVoucherDeliverySent,
  type VoucherDeliveryChannel,
} from "@/lib/payment/voucherDeliveryOutbox";
import { sendVoucherEmail, sendVoucherWhatsApp } from "@/lib/payment/public-voucher-delivery";
import type {
  OrderItemWithService,
  OrderWithService,
  Voucher,
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

  const voucher = await createVoucherForPaidOrderItem(order.id, item.id);
  if (!voucher) {
    throw new Error("Failed to create voucher in database");
  }
  return voucher;
}

interface SingleVoucherCreation {
  result: VoucherCreationResult;
  voucher: Voucher | null;
}

async function createSingleVoucher(
  order: OrderWithService
): Promise<SingleVoucherCreation> {
  const validationError = validateVoucherSource(order);
  if (validationError) {
    return {
      result: { success: false, error: validationError },
      voucher: null,
    };
  }

  const voucher = await createVoucherForPaidOrder(order.id);
  if (!voucher) {
    return {
      result: {
        success: false,
        error: "Failed to create voucher in database",
      },
      voucher: null,
    };
  }

  return {
    result: {
      success: true,
      voucherId: voucher.id,
      voucherCode: voucher.code,
      voucherCount: 1,
      ...(order.voucher_id ? { error: "Voucher already created" } : {}),
    },
    voucher,
  };
}

function getDeliveryChannels(
  deliveryMethod: OrderWithService["delivery_method"]
): VoucherDeliveryChannel[] {
  if (deliveryMethod === "BOTH") {
    return ["EMAIL", "WHATSAPP"];
  }
  if (deliveryMethod === "EMAIL" || deliveryMethod === "WHATSAPP") {
    return [deliveryMethod];
  }
  return [];
}

async function deliverVoucher(
  order: OrderWithService,
  voucher: Voucher,
  item?: OrderItemWithService
): Promise<void> {
  const channels = getDeliveryChannels(
    item?.delivery_method ?? order.delivery_method
  );
  const itemId = item?.id;
  const claimed = await claimVoucherDeliveries({
    orderId: order.id,
    orderItemId: itemId ?? null,
    voucherId: voucher.id,
    channels,
  });

  if (claimed.length === 0) {
    return;
  }

  if (!order.payment_order_id || !order.public_access_token) {
    const credentialsError = new Error(
      "Missing public access credentials for voucher delivery"
    );
    const failedUpdates = await Promise.allSettled(
      claimed.map((delivery) =>
        markVoucherDeliveryFailed(
          delivery.id,
          delivery.claimToken,
          credentialsError
        )
      )
    );
    const failedPersistence = failedUpdates.find(
      (result): result is PromiseRejectedResult => result.status === "rejected"
    );
    if (failedPersistence) {
      throw failedPersistence.reason;
    }
    throw credentialsError;
  }

  await Promise.all(
    claimed.map(async (delivery) => {
      try {
        if (delivery.channel === "EMAIL") {
          await sendVoucherEmail(
            order.payment_order_id!,
            order.public_access_token!,
            itemId
          );
        } else {
          await sendVoucherWhatsApp(
            order.payment_order_id!,
            order.public_access_token!,
            itemId
          );
        }
        await markVoucherDeliverySent(delivery.id, delivery.claimToken);
      } catch (error) {
        await markVoucherDeliveryFailed(delivery.id, delivery.claimToken, error);
        throw error;
      }
    })
  );
}

export async function createVoucherOnPaymentSuccess(
  order: OrderWithService
): Promise<VoucherCreationResult> {
  try {
    const orderItems = await getOrderItemsByOrderId(order.id);
    if (orderItems.length > 0) {
      const createdVouchers = await Promise.all(
        orderItems.map((item) => createVoucherForOrderItem(order, item))
      );
      const firstVoucher = createdVouchers.find(Boolean);

      if (firstVoucher && !order.voucher_id) {
        await updateOrderVoucherId(order.id, firstVoucher.id);
      }

      await Promise.all(
        orderItems.map((item, index) =>
          deliverVoucher(order, createdVouchers[index]!, item)
        )
      );

      return {
        success: true,
        voucherId: firstVoucher?.id,
        voucherCode: firstVoucher?.code,
        voucherCount: createdVouchers.filter(Boolean).length,
      };
    }

    const singleCreation = await createSingleVoucher(order);
    if (singleCreation.result.success && singleCreation.voucher) {
      await deliverVoucher(order, singleCreation.voucher);
    }

    return singleCreation.result;
  } catch (error) {
    console.error("[VoucherService] Error creating voucher:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}
