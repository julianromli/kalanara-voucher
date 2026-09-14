import "server-only";

import { getAdminClient } from "@/lib/supabase/admin";
import type { OrderWithItems, OrderWithVoucher } from "@/lib/database.types";

const ORDER_VOUCHER_SELECT =
  "*, services(*), vouchers:vouchers!orders_voucher_id_fkey(*, services(*))";
const ORDER_ITEMS_SELECT =
  "*, services(*), vouchers:vouchers!orders_voucher_id_fkey(*, services(*)), order_items(*, services(*), vouchers:vouchers!order_items_voucher_id_fkey(*))";

/**
 * Compatibility read for server-to-server voucher delivery routes.
 * The durable capability must never be returned to browser code.
 */
export async function getPublicOrderDetails(
  paymentOrderId: string,
  publicAccessToken: string
): Promise<OrderWithVoucher | null> {
  const { data, error } = await getAdminClient()
    .from("orders")
    .select(ORDER_VOUCHER_SELECT)
    .eq("payment_order_id", paymentOrderId)
    .eq("public_access_token", publicAccessToken)
    .single();

  if (error) {
    console.error("Error fetching capability-bound order details:", error);
    return null;
  }

  return data as OrderWithVoucher;
}

/**
 * Compatibility read for server-to-server voucher delivery routes.
 * The durable capability must never be returned to browser code.
 */
export async function getPublicOrderDetailsWithItems(
  paymentOrderId: string,
  publicAccessToken: string
): Promise<OrderWithItems | null> {
  const { data, error } = await getAdminClient()
    .from("orders")
    .select(ORDER_ITEMS_SELECT)
    .eq("payment_order_id", paymentOrderId)
    .eq("public_access_token", publicAccessToken)
    .order("sort_order", { ascending: true, referencedTable: "order_items" })
    .order("created_at", { ascending: true, referencedTable: "order_items" })
    .single();

  if (error) {
    console.error("Error fetching capability-bound order item details:", error);
    return null;
  }

  return data as OrderWithItems;
}
