import "server-only";

import { randomBytes } from "node:crypto";
import { allocateDiscountAcrossItems } from "@/lib/discounts/service";
import {
  transitionOrderPaymentState,
  type GatewayPaymentUpdate,
} from "@/lib/payment/payment-state";
import { mapScalevPaymentMethodToLocal } from "@/lib/scalev/mappers";
import { getAdminClient } from "@/lib/supabase/admin";
import type {
  Database,
  Order,
  OrderItem,
  OrderItemInsert,
  OrderItemUpdate,
  OrderUpdate,
} from "@/lib/database.types";
import type {
  ScalevPendingOrderData,
  ScalevPendingOrderItemData,
} from "@/lib/scalev/types";

export type PendingOrderItemInput = Pick<
  ScalevPendingOrderItemData,
  | "service_id"
  | "recipient_name"
  | "recipient_email"
  | "recipient_phone"
  | "sender_message"
  | "delivery_method"
  | "send_to"
  | "sort_order"
>;

export type { GatewayPaymentUpdate } from "@/lib/payment/payment-state";

function generatePaymentOrderId(): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `KSP-${timestamp}-${random}`;
}

function generatePublicAccessToken(): string {
  return randomBytes(24).toString("base64url");
}

async function checkPaymentOrderIdExists(
  paymentOrderId: string
): Promise<boolean> {
  const supabase = getAdminClient();
  const { data } = await supabase
    .from("orders")
    .select("id")
    .eq("payment_order_id", paymentOrderId)
    .single();

  return data !== null;
}

async function generateUniquePaymentOrderId(): Promise<string> {
  for (let index = 0; index < 3; index += 1) {
    const orderId = generatePaymentOrderId();
    if (!(await checkPaymentOrderIdExists(orderId))) {
      return orderId;
    }
  }

  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 10).toUpperCase();
  return `KSP-${timestamp}-${random}`;
}

export async function createPendingOrderForCheckout(
  data: ScalevPendingOrderData
): Promise<Order | null> {
  const supabase = getAdminClient();
  const paymentOrderId = await generateUniquePaymentOrderId();
  const orderData: Database["public"]["Tables"]["orders"]["Insert"] = {
    voucher_id: null,
    customer_email: data.customer_email,
    customer_name: data.customer_name,
    customer_phone: data.customer_phone,
    payment_method: mapScalevPaymentMethodToLocal(data.payment_method),
    payment_status: "PENDING",
    subtotal_amount: data.subtotal_amount,
    discount_code_id: data.discount_code_id ?? null,
    discount_code: data.discount_code ?? null,
    discount_type_snapshot: data.discount_type_snapshot ?? null,
    discount_value_snapshot: data.discount_value_snapshot ?? null,
    discount_amount: data.discount_amount ?? 0,
    total_amount: data.total_amount,
    payment_order_id: paymentOrderId,
    public_access_token: generatePublicAccessToken(),
    service_id: data.service_id ?? null,
    recipient_name: data.recipient_name ?? null,
    recipient_email: data.recipient_email ?? null,
    recipient_phone: data.recipient_phone ?? null,
    sender_message: data.sender_message ?? null,
    delivery_method: data.delivery_method ?? null,
    send_to: data.send_to ?? null,
    payment_provider: "scalev",
    scalev_payment_method: data.payment_method || null,
    scalev_sub_payment_method: data.sub_payment_method || null,
  };

  const { data: order, error } = await supabase
    .from("orders")
    .insert(orderData)
    .select()
    .single();

  if (error) {
    console.error("Error creating pending order:", error);
    return null;
  }

  return order as Order;
}

export async function createPendingOrderItemsForOrder(
  orderId: string,
  items: readonly PendingOrderItemInput[]
): Promise<OrderItem[] | null> {
  if (items.length === 0) {
    return [];
  }

  const supabase = getAdminClient();
  const { data: order, error: orderError } = await supabase
    .from("orders")
    .select(
      "id, subtotal_amount, discount_amount, total_amount, payment_status, payment_provider"
    )
    .eq("id", orderId)
    .single();

  if (
    orderError ||
    !order ||
    order.payment_status !== "PENDING" ||
    order.payment_provider !== "scalev"
  ) {
    console.error("Error loading trusted pending order:", orderError);
    return null;
  }

  const serviceIds = [...new Set(items.map((item) => item.service_id))];
  const { data: services, error: servicesError } = await supabase
    .from("services")
    .select("id, price, is_active")
    .in("id", serviceIds);

  if (servicesError || !services) {
    console.error("Error loading authoritative services:", servicesError);
    return null;
  }

  const servicesById = new Map(
    services.map((service) => [service.id, service] as const)
  );
  const authoritativePrices = items.map(
    (item) => servicesById.get(item.service_id)?.price
  );
  if (
    authoritativePrices.some((price) => price === undefined) ||
    items.some((item) => !servicesById.get(item.service_id)?.is_active)
  ) {
    return null;
  }

  const prices = authoritativePrices as number[];
  const subtotalAmount = prices.reduce((sum, price) => sum + price, 0);
  const itemDiscounts = allocateDiscountAcrossItems(
    prices,
    order.discount_amount
  );
  const totalAmount = prices.reduce(
    (sum, price, index) => sum + price - itemDiscounts[index],
    0
  );

  if (
    subtotalAmount !== order.subtotal_amount ||
    totalAmount !== order.total_amount
  ) {
    console.error("Stored order pricing does not match authoritative services");
    return null;
  }

  const insertRows = items.map((item, index) => {
    const finalUnitPrice = prices[index] - itemDiscounts[index];
    return {
      order_id: order.id,
      service_id: item.service_id,
      original_unit_price: prices[index],
      discount_amount: itemDiscounts[index],
      final_unit_price: finalUnitPrice,
      unit_price: finalUnitPrice,
      recipient_name: item.recipient_name,
      recipient_email: item.recipient_email || null,
      recipient_phone: item.recipient_phone || null,
      sender_message: item.sender_message || null,
      delivery_method: item.delivery_method,
      send_to: item.send_to,
      sort_order: item.sort_order ?? index,
    } satisfies OrderItemInsert;
  });

  const { data, error } = await supabase
    .from("order_items")
    .insert(
      insertRows as Database["public"]["Tables"]["order_items"]["Insert"][]
    )
    .select();

  if (error) {
    console.error("Error creating pending order items:", {
      code: error.code,
      message: error.message,
      details: error.details,
      hint: error.hint,
    });
    return null;
  }

  return (data as OrderItem[]) || [];
}

export async function markOrderFailedFromGateway(
  orderId: string,
  details?: Pick<
    GatewayPaymentUpdate,
    | "paymentProvider"
    | "transactionId"
    | "paymentType"
    | "transactionTime"
    | "scalevOrderPk"
    | "scalevOrderId"
    | "scalevPgReferenceId"
    | "scalevPaymentMethod"
    | "scalevSubPaymentMethod"
    | "scalevStoreUniqueId"
    | "scalevRawStatus"
    | "scalevRawPaymentStatus"
  >
): Promise<boolean> {
  const receiptTime = new Date().toISOString();
  const result = await transitionOrderPaymentState({
    orderId,
    targetStatus: "FAILED",
    provider: details?.paymentProvider || "scalev",
    providerEventAt: details?.transactionTime || receiptTime,
    gatewayUpdate: {
      ...details,
      transactionTime: details?.transactionTime || receiptTime,
      scalevLastCheckedAt: receiptTime,
    },
  });

  return result.accepted;
}

export async function updateOrderVoucherId(
  orderId: string,
  voucherId: string
): Promise<boolean> {
  const supabase = getAdminClient();
  const { error } = await supabase
    .from("orders")
    .update({ voucher_id: voucherId } satisfies OrderUpdate)
    .eq("id", orderId);

  if (error) {
    console.error("Error updating order voucher ID:", error);
    return false;
  }

  return true;
}

export async function updateOrderItemVoucherId(
  orderItemId: string,
  voucherId: string
): Promise<boolean> {
  const supabase = getAdminClient();
  const { error } = await supabase
    .from("order_items")
    .update({ voucher_id: voucherId } satisfies OrderItemUpdate)
    .eq("id", orderItemId);

  if (error) {
    console.error("Error updating order item voucher ID:", error);
    return false;
  }

  return true;
}
