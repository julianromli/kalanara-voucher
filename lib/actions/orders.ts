"use server";

import { randomBytes } from "node:crypto";
import { revalidateTag } from "next/cache";
import { AdminPermission } from "@/lib/auth/admin-rbac";
import {
  logAdminAudit,
  requireAdminPermission,
} from "@/lib/auth/admin-rbac-server";
import { getAdminClient } from "@/lib/supabase/admin";
import { mapScalevPaymentMethodToLocal } from "@/lib/scalev/mappers";
import type {
  Database,
  Order,
  OrderInsert,
  OrderUpdate,
  OrderWithService,
  OrderWithVoucher,
  PaymentStatus,
} from "@/lib/database.types";
import type { ScalevPendingOrderData } from "@/lib/scalev/types";

const ORDER_VOUCHER_SELECT =
  "*, vouchers:vouchers!orders_voucher_id_fkey(*, services(*))";

interface GatewayPaymentUpdate {
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

export async function getOrders(): Promise<OrderWithVoucher[]> {
  await requireAdminPermission(AdminPermission.ORDERS_VIEW);

  const supabase = getAdminClient();
  const { data, error } = await supabase
    .from("orders")
    .select(ORDER_VOUCHER_SELECT)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching orders:", error);
    return [];
  }

  return (data as OrderWithVoucher[]) || [];
}

export async function getOrderById(id: string): Promise<OrderWithVoucher | null> {
  await requireAdminPermission(AdminPermission.ORDERS_VIEW);

  const supabase = getAdminClient();
  const { data, error } = await supabase
    .from("orders")
    .select(ORDER_VOUCHER_SELECT)
    .eq("id", id)
    .single();

  if (error) {
    console.error("Error fetching order:", error);
    return null;
  }

  return data as OrderWithVoucher;
}

export async function createOrder(order: OrderInsert): Promise<Order | null> {
  const supabase = getAdminClient();
  const { data, error } = await supabase
    .from("orders")
    .insert(order as Database["public"]["Tables"]["orders"]["Insert"])
    .select()
    .single();

  if (error) {
    console.error("Error creating order:", error);
    return null;
  }

  revalidateTag("dashboard-stats", "max");
  return data as Order;
}

export async function updateOrderStatus(
  id: string,
  status: PaymentStatus
): Promise<boolean> {
  const access = await requireAdminPermission(
    AdminPermission.ORDERS_UPDATE_PAYMENT_STATUS
  );

  const supabase = getAdminClient();
  const { error } = await supabase
    .from("orders")
    .update({ payment_status: status } satisfies OrderUpdate)
    .eq("id", id);

  if (error) {
    console.error("Error updating order status:", error);
    return false;
  }

  logAdminAudit(access, {
    action: "order.payment_status_update",
    target: id,
    details: { status },
  });

  revalidateTag("dashboard-stats", "max");
  return true;
}

export async function getOrderStats(): Promise<{
  totalRevenue: number;
  totalOrders: number;
  completedOrders: number;
  pendingOrders: number;
}> {
  await requireAdminPermission(AdminPermission.ORDERS_VIEW);

  const supabase = getAdminClient();
  const { data, error } = await supabase
    .from("orders")
    .select("total_amount, payment_status");

  if (error || !data) {
    return {
      totalRevenue: 0,
      totalOrders: 0,
      completedOrders: 0,
      pendingOrders: 0,
    };
  }

  const completedOrders = data.filter((item) => item.payment_status === "COMPLETED");
  const pendingOrders = data.filter((item) => item.payment_status === "PENDING");

  return {
    totalRevenue: completedOrders.reduce((sum, item) => sum + item.total_amount, 0),
    totalOrders: data.length,
    completedOrders: completedOrders.length,
    pendingOrders: pendingOrders.length,
  };
}

export async function checkPaymentOrderIdExists(
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

export async function generateUniquePaymentOrderId(): Promise<string> {
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

export async function createPendingOrder(
  data: ScalevPendingOrderData
): Promise<Order | null> {
  const supabase = getAdminClient();
  const paymentOrderId = await generateUniquePaymentOrderId();

  const orderData: OrderInsert = {
    voucher_id: null,
    customer_email: data.customer_email,
    customer_name: data.customer_name,
    customer_phone: data.customer_phone,
    payment_method: mapScalevPaymentMethodToLocal(data.payment_method),
    payment_status: "PENDING",
    total_amount: data.total_amount,
    payment_order_id: paymentOrderId,
    public_access_token: generatePublicAccessToken(),
    service_id: data.service_id,
    recipient_name: data.recipient_name,
    recipient_email: data.recipient_email || null,
    recipient_phone: data.recipient_phone,
    sender_message: data.sender_message || null,
    delivery_method: data.delivery_method,
    send_to: data.send_to,
    payment_provider: "scalev",
    scalev_payment_method: data.payment_method || null,
    scalev_sub_payment_method: data.sub_payment_method || null,
  };

  const { data: order, error } = await supabase
    .from("orders")
    .insert(orderData as Database["public"]["Tables"]["orders"]["Insert"])
    .select()
    .single();

  if (error) {
    console.error("Error creating pending order:", error);
    return null;
  }

  return order as Order;
}

export async function getOrderByPaymentOrderId(
  paymentOrderId: string
): Promise<OrderWithService | null> {
  const supabase = getAdminClient();
  const { data, error } = await supabase
    .from("orders")
    .select("*, services(*)")
    .eq("payment_order_id", paymentOrderId)
    .single();

  if (error) {
    console.error("Error fetching order by payment order ID:", error);
    return null;
  }

  return data as OrderWithService;
}

export async function getOrderByPaymentOrderIdAndAccessToken(
  paymentOrderId: string,
  publicAccessToken: string
): Promise<OrderWithService | null> {
  const supabase = getAdminClient();
  const { data, error } = await supabase
    .from("orders")
    .select("*, services(*)")
    .eq("payment_order_id", paymentOrderId)
    .eq("public_access_token", publicAccessToken)
    .single();

  if (error) {
    console.error("Error fetching order by payment order ID and access token:", error);
    return null;
  }

  return data as OrderWithService;
}

export async function getOrderByTransactionId(
  transactionId: string
): Promise<OrderWithService | null> {
  const supabase = getAdminClient();
  const { data, error } = await supabase
    .from("orders")
    .select("*, services(*)")
    .eq("payment_transaction_id", transactionId)
    .single();

  if (error) {
    console.error("Error fetching order by transaction ID:", error);
    return null;
  }

  return data as OrderWithService;
}

export async function getOrderByScalevOrderPk(
  scalevOrderPk: number
): Promise<OrderWithService | null> {
  const supabase = getAdminClient();
  const { data, error } = await supabase
    .from("orders")
    .select("*, services(*)")
    .eq("scalev_order_pk", scalevOrderPk)
    .single();

  if (error) {
    console.error("Error fetching order by Scalev order pk:", error);
    return null;
  }

  return data as OrderWithService;
}

export async function getOrderByScalevPgReferenceId(
  pgReferenceId: string
): Promise<OrderWithService | null> {
  const supabase = getAdminClient();
  const { data, error } = await supabase
    .from("orders")
    .select("*, services(*)")
    .eq("scalev_pg_reference_id", pgReferenceId)
    .single();

  if (error) {
    console.error("Error fetching order by Scalev pg reference:", error);
    return null;
  }

  return data as OrderWithService;
}

export async function getOrderByScalevOrderId(
  scalevOrderId: string
): Promise<OrderWithService | null> {
  const supabase = getAdminClient();
  const { data, error } = await supabase
    .from("orders")
    .select("*, services(*)")
    .eq("scalev_order_id", scalevOrderId)
    .single();

  if (error) {
    console.error("Error fetching order by Scalev order id:", error);
    return null;
  }

  return data as OrderWithService;
}

export async function getPublicOrderDetails(
  paymentOrderId: string,
  publicAccessToken: string
): Promise<OrderWithVoucher | null> {
  const supabase = getAdminClient();
  const { data, error } = await supabase
    .from("orders")
    .select(ORDER_VOUCHER_SELECT)
    .eq("payment_order_id", paymentOrderId)
    .eq("public_access_token", publicAccessToken)
    .single();

  if (error) {
    console.error("Error fetching public order details:", error);
    return null;
  }

  return data as OrderWithVoucher;
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
    updateData.payment_provider = paymentData.paymentProvider || updateData.payment_provider;
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
    updateData.scalev_sub_payment_method = paymentData.scalevSubPaymentMethod ?? null;
    updateData.scalev_store_unique_id = paymentData.scalevStoreUniqueId ?? null;
    updateData.scalev_last_checked_at = paymentData.scalevLastCheckedAt ?? null;
    updateData.scalev_raw_status = paymentData.scalevRawStatus ?? null;
    updateData.scalev_raw_payment_status = paymentData.scalevRawPaymentStatus ?? null;
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

