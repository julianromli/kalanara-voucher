import "server-only";

import { getAdminClient } from "@/lib/supabase/admin";
import type {
  OrderWithItems,
  OrderWithService,
  OrderWithVoucher,
} from "@/lib/database.types";

const ORDER_VOUCHER_SELECT =
  "*, services(*), vouchers:vouchers!orders_voucher_id_fkey(*, services(*))";
const ORDER_ITEMS_SELECT =
  "*, services(*), order_items(*, services(*), vouchers:vouchers!order_items_voucher_id_fkey(*))";

function throwOrderStatusReadError(cause: unknown): never {
  throw new Error("Failed to fetch order status.", { cause });
}

export async function getOrderForStatusById(
  orderId: string
): Promise<OrderWithService | null> {
  const { data, error } = await getAdminClient()
    .from("orders")
    .select("*, services(*)")
    .eq("id", orderId)
    .maybeSingle();

  if (error) {
    throwOrderStatusReadError(error);
  }

  return data as OrderWithService | null;
}

export async function getOrderStatusDetailsById(
  orderId: string
): Promise<OrderWithVoucher | null> {
  const { data, error } = await getAdminClient()
    .from("orders")
    .select(ORDER_VOUCHER_SELECT)
    .eq("id", orderId)
    .maybeSingle();

  if (error) {
    throwOrderStatusReadError(error);
  }

  return data as OrderWithVoucher | null;
}

export async function getOrderStatusDetailsWithItemsById(
  orderId: string
): Promise<OrderWithItems | null> {
  const { data, error } = await getAdminClient()
    .from("orders")
    .select(ORDER_ITEMS_SELECT)
    .eq("id", orderId)
    .order("sort_order", { ascending: true, referencedTable: "order_items" })
    .order("created_at", { ascending: true, referencedTable: "order_items" })
    .maybeSingle();

  if (error) {
    throwOrderStatusReadError(error);
  }

  return data as OrderWithItems | null;
}
