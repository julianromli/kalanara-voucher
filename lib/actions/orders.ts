"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { AdminPermission } from "@/lib/auth/admin-rbac";
import {
  logAdminAudit,
  requireAdminPermission,
} from "@/lib/auth/admin-rbac-server";
import { getAdminClient } from "@/lib/supabase/admin";
import type {
  OrderItemWithService,
  OrderUpdate,
  OrderWithService,
  OrderWithVoucher,
  OrderWithVoucherItems,
  PaymentStatus,
} from "@/lib/database.types";

const ORDER_VOUCHER_SELECT =
  "*, services(*), vouchers:vouchers!orders_voucher_id_fkey(*, services(*))";
const ORDER_ADMIN_SELECT =
  "*, services(*), vouchers:vouchers!orders_voucher_id_fkey(*, services(*)), order_items(*, services(*), vouchers:vouchers!order_items_voucher_id_fkey(*))";

export interface DestructiveOrderActionResult {
  success: boolean;
  message: string;
  deletedOrderCount: number;
  deletedVoucherCount: number;
  deletedReviewCount: number;
  deletedWebhookEventCount: number;
}

interface HardDeleteOrdersRpcRow {
  success: boolean;
  message: string;
  deleted_order_count: number;
  deleted_voucher_count: number;
  deleted_review_count: number;
  deleted_webhook_event_count: number;
}

function revalidateOrderAdminData() {
  revalidateTag("dashboard-stats", "max");
  revalidatePath("/admin/dashboard", "page");
  revalidatePath("/admin/purchases", "page");
}

function createDeleteFailureResult(message: string): DestructiveOrderActionResult {
  return {
    success: false,
    message,
    deletedOrderCount: 0,
    deletedVoucherCount: 0,
    deletedReviewCount: 0,
    deletedWebhookEventCount: 0,
  };
}

function normalizeHardDeleteResult(
  payload: HardDeleteOrdersRpcRow | null | undefined
): DestructiveOrderActionResult {
  if (!payload) {
    return createDeleteFailureResult(
      "Fungsi penghapusan permanen belum tersedia di database. Jalankan migration terbaru terlebih dahulu."
    );
  }

  return {
    success: payload.success,
    message: payload.message,
    deletedOrderCount: payload.deleted_order_count,
    deletedVoucherCount: payload.deleted_voucher_count,
    deletedReviewCount: payload.deleted_review_count,
    deletedWebhookEventCount: payload.deleted_webhook_event_count,
  };
}

async function hardDeleteOrdersTransactional(
  orderIds?: readonly string[]
): Promise<DestructiveOrderActionResult> {
  const supabase = getAdminClient();
  const { data, error } = await supabase.rpc("hard_delete_orders", {
    order_ids: orderIds && orderIds.length > 0 ? [...orderIds] : null,
  });

  if (error) {
    console.error("Error hard deleting orders transactionally:", error);

    if (error.code === "PGRST202") {
      return createDeleteFailureResult(
        "Fungsi penghapusan permanen belum tersedia di database. Jalankan migration terbaru terlebih dahulu."
      );
    }

    throw error;
  }

  const payload = Array.isArray(data) ? (data[0] ?? null) : null;

  const result = normalizeHardDeleteResult(payload);

  if (result.success) {
    revalidateOrderAdminData();
  }

  return result;
}

export async function getOrders(): Promise<OrderWithVoucherItems[]> {
  await requireAdminPermission(AdminPermission.ORDERS_VIEW);

  const supabase = getAdminClient();
  const { data, error } = await supabase
    .from("orders")
    .select(ORDER_ADMIN_SELECT)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching orders:", error);
    return [];
  }

  return (data as OrderWithVoucherItems[]) || [];
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

export async function deleteOrderHard(id: string): Promise<DestructiveOrderActionResult> {
  const access = await requireAdminPermission(AdminPermission.ORDERS_DELETE_HARD);

  const normalizedId = id.trim();
  if (!normalizedId) {
    return createDeleteFailureResult("ID pembelian tidak valid.");
  }

  const result = await hardDeleteOrdersTransactional([normalizedId]);

  if (result.success) {
    logAdminAudit(access, {
      action: "order.hard_delete",
      target: normalizedId,
      details: {
        deletedOrderCount: result.deletedOrderCount,
        deletedVoucherCount: result.deletedVoucherCount,
        deletedReviewCount: result.deletedReviewCount,
        deletedWebhookEventCount: result.deletedWebhookEventCount,
      },
    });
  }

  return result;
}

export async function clearAllOrdersHard(): Promise<DestructiveOrderActionResult> {
  const access = await requireAdminPermission(AdminPermission.ORDERS_DELETE_HARD);
  const result = await hardDeleteOrdersTransactional();

  if (result.success) {
    logAdminAudit(access, {
      action: "order.hard_delete_all",
      details: {
        deletedOrderCount: result.deletedOrderCount,
        deletedVoucherCount: result.deletedVoucherCount,
        deletedReviewCount: result.deletedReviewCount,
        deletedWebhookEventCount: result.deletedWebhookEventCount,
      },
    });
  }

  return result;
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

export async function getOrderItemsByOrderId(
  orderId: string
): Promise<OrderItemWithService[]> {
  const supabase = getAdminClient();
  const { data, error } = await supabase
    .from("order_items")
    .select("*, services(*), vouchers:vouchers!order_items_voucher_id_fkey(*)")
    .eq("order_id", orderId)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) {
    console.error("Error fetching order items:", error);
    return [];
  }

  return (data as OrderItemWithService[]) || [];
}
