import "server-only";

import { randomBytes } from "node:crypto";
import { revalidateTag } from "next/cache";
import { allocateDiscountAcrossItems } from "@/lib/discounts/service";
import { mapScalevPaymentMethodToLocal } from "@/lib/scalev/mappers";
import { getAdminClient } from "@/lib/supabase/admin";
import type {
  Database,
  Order,
  OrderItem,
  OrderItemInsert,
  OrderItemUpdate,
  OrderUpdate,
  PaymentStatus,
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

export interface GatewayPaymentUpdate {
  transactionId?: string | null;
  paymentType?: string | null;
  transactionTime?: string | null;
  transaction_id?: string | null;
  payment_type?: string | null;
  transaction_time?: string | null;
  paymentProvider?: string;
  paymentLink?: string | null;
  scalevOrderPk?: number | null;
  scalevOrderId?: string | null;
  scalevPgReferenceId?: string | null;
  scalevPaymentMethod?: string | null;
  scalevSubPaymentMethod?: string | null;
  scalevStoreUniqueId?: string | null;
  scalevLastCheckedAt?: string | null;
  scalevRawStatus?: string | null;
  scalevRawPaymentStatus?: string | null;
}

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

export async function updateOrderPaymentStatus(
  orderId: string,
  status: PaymentStatus,
  paymentData?: GatewayPaymentUpdate
): Promise<boolean> {
  const supabase = getAdminClient();
  const updateData: OrderUpdate = {
    payment_status: status,
  };

  if (paymentData) {
    updateData.payment_provider =
      paymentData.paymentProvider || updateData.payment_provider;
    updateData.payment_transaction_id =
      paymentData.transactionId ?? paymentData.transaction_id ?? null;
    updateData.payment_type =
      paymentData.paymentType ?? paymentData.payment_type ?? null;
    updateData.payment_transaction_time =
      paymentData.transactionTime ?? paymentData.transaction_time ?? null;
    updateData.payment_link = paymentData.paymentLink ?? null;
    updateData.scalev_order_pk = paymentData.scalevOrderPk ?? null;
    updateData.scalev_order_id = paymentData.scalevOrderId ?? null;
    updateData.scalev_pg_reference_id = paymentData.scalevPgReferenceId ?? null;
    updateData.scalev_payment_method = paymentData.scalevPaymentMethod ?? null;
    updateData.scalev_sub_payment_method =
      paymentData.scalevSubPaymentMethod ?? null;
    updateData.scalev_store_unique_id =
      paymentData.scalevStoreUniqueId ?? null;
    updateData.scalev_last_checked_at = paymentData.scalevLastCheckedAt ?? null;
    updateData.scalev_raw_status = paymentData.scalevRawStatus ?? null;
    updateData.scalev_raw_payment_status =
      paymentData.scalevRawPaymentStatus ?? null;
  }

  const { error } = await supabase
    .from("orders")
    .update(updateData)
    .eq("id", orderId);

  if (error) {
    console.error("Error updating gateway order status:", error);
    return false;
  }

  revalidateTag("dashboard-stats", "max");
  return true;
}

export async function updateOrderGatewayData(
  orderId: string,
  updates: GatewayPaymentUpdate
): Promise<boolean> {
  return updateOrderPaymentStatus(orderId, "PENDING", updates);
}

export async function markOrderFailedFromGateway(
  orderId: string,
  details?: Pick<
    GatewayPaymentUpdate,
    | "paymentProvider"
    | "transactionId"
    | "paymentType"
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
  return updateOrderPaymentStatus(orderId, "FAILED", {
    ...details,
    scalevLastCheckedAt: new Date().toISOString(),
  });
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
