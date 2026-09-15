"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { AdminPermission } from "@/lib/auth/admin-rbac";
import {
  logAdminAudit,
  requireAdminPermission,
} from "@/lib/auth/admin-rbac-server";
import {
  ADMIN_PAGE_SIZE,
  buildAdminPage,
  normalizeAdminListParams,
  type AdminListParams,
  type AdminPage,
} from "@/lib/actions/admin-pagination";
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
const ORDER_ADMIN_LIST_SELECT =
  "id, customer_email, customer_name, customer_phone, payment_status, payment_provider, total_amount, created_at, payment_order_id, payment_transaction_id, payment_type, payment_transaction_time, scalev_order_id, scalev_pg_reference_id, scalev_payment_method, vouchers:vouchers!orders_voucher_id_fkey(id, code, services(name, duration)), order_items(id, voucher_id, recipient_name, delivery_method, send_to, sort_order, created_at, unit_price, services(name), vouchers:vouchers!order_items_voucher_id_fkey(code))";
const ORDER_ADMIN_FILTERS = [
  "ALL",
  "PENDING",
  "COMPLETED",
  "FAILED",
  "REFUNDED",
] as const;

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

export async function getOrdersPage(
  params: AdminListParams,
): Promise<AdminPage<OrderWithVoucherItems>> {
  await requireAdminPermission(AdminPermission.ORDERS_VIEW);

  const normalized = normalizeAdminListParams(
    {
      page: String(params.page),
      query: params.query,
      filter: params.filter,
    },
    ORDER_ADMIN_FILTERS,
  );
  const from = (normalized.page - 1) * ADMIN_PAGE_SIZE;
  const supabase = getAdminClient();
  const source = normalized.query
    ? supabase.rpc("search_admin_orders", {
        search_query: normalized.query,
      })
    : supabase.from("orders");
  let request = source
    .select(ORDER_ADMIN_LIST_SELECT, { count: "exact" })
    .order("created_at", { ascending: false })
    .order("id", { ascending: false });

  if (normalized.filter !== "ALL") {
    request = request.eq("payment_status", normalized.filter as PaymentStatus);
  }

  const firstResult = await request.range(
    from,
    from + ADMIN_PAGE_SIZE - 1,
  );

  if (firstResult.error) {
    console.error("Error fetching orders:", firstResult.error);
    throw firstResult.error;
  }

  const firstPage = buildAdminPage(
    (firstResult.data as OrderWithVoucherItems[]) ?? [],
    normalized.page,
    firstResult.count ?? 0,
  );
  if (firstPage.page === normalized.page || firstPage.totalCount === 0) {
    return firstPage;
  }

  const correctedFrom = (firstPage.page - 1) * ADMIN_PAGE_SIZE;
  const correctedResult = await request.range(
    correctedFrom,
    correctedFrom + ADMIN_PAGE_SIZE - 1,
  );
  if (correctedResult.error) {
    console.error("Error fetching corrected orders page:", correctedResult.error);
    throw correctedResult.error;
  }

  return buildAdminPage(
    (correctedResult.data as OrderWithVoucherItems[]) ?? [],
    firstPage.page,
    correctedResult.count ?? firstPage.totalCount,
  );
}

export async function getOrdersTotalCount(): Promise<number> {
  await requireAdminPermission(AdminPermission.ORDERS_VIEW);

  const { count, error } = await getAdminClient()
    .from("orders")
    .select("id", { count: "exact", head: true });

  if (error) {
    console.error("Error counting orders:", error);
    throw error;
  }

  return count ?? 0;
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

export async function getOrderByScalevOrderPk(scalevOrderPk: string): Promise<OrderWithService | null> {
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
