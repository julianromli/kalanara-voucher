"use server";

import { AdminPermission } from "@/lib/auth/admin-rbac";
import { requireAdminPermission } from "@/lib/auth/admin-rbac-server";
import {
  ADMIN_PAGE_SIZE,
  buildAdminPage,
  normalizeAdminListParams,
  type AdminListParams,
  type AdminPage,
} from "@/lib/actions/admin-pagination";
import { normalizeBuyerPhone } from "@/lib/admin/buyer-phone";
import { getAdminClient } from "@/lib/supabase/admin";
import type { OrderWithVoucherItems } from "@/lib/database.types";

const BUYER_ORDER_SELECT =
  "id, customer_email, customer_name, customer_phone, payment_status, payment_provider, total_amount, created_at, payment_order_id, vouchers:vouchers!orders_voucher_id_fkey(id, code, services(name, duration)), order_items(id, voucher_id, recipient_name, delivery_method, send_to, sort_order, created_at, unit_price, services(name), vouchers:vouchers!order_items_voucher_id_fkey(code))";

export interface AdminBuyer {
  phone: string;
  customerName: string;
  customerEmail: string;
  orderCount: number;
  voucherCount: number;
  lastOrderAt: string;
  otherNames: string[];
}

interface BuyerRpcRow {
  phone: string;
  customer_name: string;
  customer_email: string;
  order_count: number;
  voucher_count: number;
  last_order_at: string;
  other_names: string[] | null;
}

function toAdminBuyer(row: BuyerRpcRow): AdminBuyer {
  return {
    phone: row.phone,
    customerName: row.customer_name,
    customerEmail: row.customer_email,
    orderCount: Number(row.order_count),
    voucherCount: Number(row.voucher_count),
    lastOrderAt: row.last_order_at,
    otherNames: row.other_names ?? [],
  };
}

export async function getBuyersPage(
  params: AdminListParams,
): Promise<AdminPage<AdminBuyer>> {
  await requireAdminPermission(AdminPermission.ORDERS_VIEW);
  const { data, error } = await getAdminClient().rpc("list_admin_buyers", {
    search_query: params.query,
  });

  if (error) {
    console.error("Error fetching buyers:", error);
    throw error;
  }

  const buyers = ((data as BuyerRpcRow[] | null) ?? []).map(toAdminBuyer);
  const from = (params.page - 1) * ADMIN_PAGE_SIZE;
  return buildAdminPage(buyers.slice(from, from + ADMIN_PAGE_SIZE), params.page, buyers.length);
}

export async function getBuyerOrders(
  phone: string,
): Promise<OrderWithVoucherItems[]> {
  await requireAdminPermission(AdminPermission.ORDERS_VIEW);
  const normalized = normalizeBuyerPhone(phone);
  if (!normalized) {
    return [];
  }

  const supabase = getAdminClient();
  const { data: orderRows, error } = await supabase.rpc("list_admin_buyer_orders", {
    buyer_phone: normalized,
  });

  if (error) {
    console.error("Error fetching buyer orders:", error);
    throw error;
  }

  const ids = (orderRows ?? []).map((order) => order.id);
  if (ids.length === 0) {
    return [];
  }

  const { data, error: detailError } = await supabase
    .from("orders")
    .select(BUYER_ORDER_SELECT)
    .in("id", ids);

  if (detailError) {
    console.error("Error fetching buyer order details:", detailError);
    throw detailError;
  }

  return ((data as unknown as OrderWithVoucherItems[] | null) ?? []).sort(
    (left, right) => right.created_at.localeCompare(left.created_at),
  );
}

export function normalizeBuyerListParams(input: {
  page?: string | string[];
  query?: string | string[];
}) {
  return normalizeAdminListParams(input, ["ALL"]);
}
