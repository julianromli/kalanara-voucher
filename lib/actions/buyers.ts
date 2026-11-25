"use server";

import { AdminPermission } from "@/lib/auth/admin-rbac";
import { requireAdminPermission } from "@/lib/auth/admin-rbac-server";
import {
  ADMIN_PAGE_SIZE,
  buildAdminPage,
  type AdminListParams,
  type AdminPage,
} from "@/lib/actions/admin-pagination";
import { attachMemberLinks, type BuyerMemberLink } from "@/lib/admin/buyer-member-match";
import { normalizeBuyerPhone } from "@/lib/admin/buyer-phone";
import { normalizeMemberPhone } from "@/lib/membership/phone";
import { jakartaDateISO } from "@/lib/membership/format";
import { getAdminClient } from "@/lib/supabase/admin";
import { fetchAllRows } from "@/lib/supabase/fetch-all-rows";
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
  member: BuyerMemberLink | null;
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
    member: null,
  };
}

export async function getBuyersPage(
  params: AdminListParams,
): Promise<AdminPage<AdminBuyer>> {
  await requireAdminPermission(AdminPermission.ORDERS_VIEW);
  const supabase = getAdminClient();
  const [{ data, error }, membersResult, stampsResult] = await Promise.all([
    supabase.rpc("list_admin_buyers", {
      search_query: params.query,
    }),
    fetchAllRows<{
      id: string;
      phone: string;
      member_code: string;
      cycle_start: string;
      base_tier: number;
    }>(() =>
      supabase.from("members").select("id, phone, member_code, cycle_start, base_tier"),
    ),
    fetchAllRows<{
      id: string;
      member_id: string;
      cycle_start: string;
      visit_date: string;
      created_at: string;
      voided_at: string | null;
    }>(() =>
      supabase
        .from("member_stamps")
        .select("id, member_id, cycle_start, visit_date, created_at, voided_at"),
    ),
  ]);

  if (error) {
    console.error("Error fetching buyers:", error);
    throw error;
  }
  if (membersResult.error) {
    console.error("Error fetching members for buyers:", membersResult.error);
    throw membersResult.error;
  }
  if (stampsResult.error) {
    console.error("Error fetching member stamps for buyers:", stampsResult.error);
    throw stampsResult.error;
  }

  const stampsByMember = new Map<string, Array<{ cycleStart: string; visitAt: string; voided: boolean }>>();
  for (const stamp of stampsResult.data) {
    const visitAt =
      (typeof stamp.created_at === "string" && stamp.created_at) ||
      (typeof stamp.visit_date === "string" && stamp.visit_date) ||
      "";
    if (!visitAt) continue;
    const list = stampsByMember.get(stamp.member_id) ?? [];
    list.push({
      cycleStart: stamp.cycle_start,
      visitAt,
      voided: stamp.voided_at != null,
    });
    stampsByMember.set(stamp.member_id, list);
  }
  const buyers = ((data as BuyerRpcRow[] | null) ?? []).map(toAdminBuyer);
  const linked = attachMemberLinks(
        buyers,
        membersResult.data.map((member) => ({
          id: member.id,
          phone: member.phone,
          memberCode: member.member_code,
          cycleStart: member.cycle_start,
          baseTier: member.base_tier,
          stamps: stampsByMember.get(member.id) ?? [],
        })),
        jakartaDateISO(),
      );
  const from = (params.page - 1) * ADMIN_PAGE_SIZE;
  return buildAdminPage(linked.slice(from, from + ADMIN_PAGE_SIZE), params.page, linked.length);
}


export async function findMemberLinkByPhone(
  phone: string,
): Promise<BuyerMemberLink | null> {
  await requireAdminPermission(AdminPermission.ORDERS_VIEW);
  const phones = [...new Set(
    [normalizeMemberPhone(phone), normalizeBuyerPhone(phone)].filter(
      (value): value is string => Boolean(value),
    ),
  )];
  if (phones.length === 0) return null;

  const supabase = getAdminClient();
  const { data: members, error } = await supabase
    .from("members")
    .select("id, phone, member_code, cycle_start, base_tier")
    .in("phone", phones);
  if (error) {
    console.error("Error finding member for buyer:", error);
    throw error;
  }
  if (!members?.length) return null;

  const ids = members.map((member) => member.id);
  const { data: stamps, error: stampsError } = await supabase
    .from("member_stamps")
    .select("id, member_id, cycle_start, visit_date, created_at, voided_at")
    .in("member_id", ids);
  if (stampsError) {
    console.error("Error finding member stamps for buyer:", stampsError);
    throw stampsError;
  }

  const stampsByMember = new Map<string, Array<{ cycleStart: string; visitAt: string; voided: boolean }>>();
  for (const stamp of stamps ?? []) {
    const visitAt =
      (typeof stamp.created_at === "string" && stamp.created_at) ||
      (typeof stamp.visit_date === "string" && stamp.visit_date) ||
      "";
    if (!visitAt) continue;
    const list = stampsByMember.get(stamp.member_id) ?? [];
    list.push({
      cycleStart: stamp.cycle_start,
      visitAt,
      voided: stamp.voided_at != null,
    });
    stampsByMember.set(stamp.member_id, list);
  }

  const [linked] = attachMemberLinks(
    [{ phone: phones[0] }],
    members.map((member) => ({
      id: member.id,
      phone: member.phone,
      memberCode: member.member_code,
      cycleStart: member.cycle_start,
      baseTier: member.base_tier,
      stamps: stampsByMember.get(member.id) ?? [],
    })),
    jakartaDateISO(),
  );
  return linked?.member ?? null;
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
