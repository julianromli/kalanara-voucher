"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { AdminPermission } from "@/lib/auth/admin-rbac";
import {
  logAdminAudit,
  requireAdminPermission,
} from "@/lib/auth/admin-rbac-server";
import {
  escapePostgrestLike,
  fetchBoundedAdminPage,
  normalizeAdminListParams,
  type AdminListParams,
  type AdminPage,
} from "@/lib/actions/admin-pagination";
import { getAdminClient } from "@/lib/supabase/admin";
import type { VoucherWithService } from "@/lib/database.types";
import type { PublicVoucherLookup } from "@/lib/types";
import { resolveServiceImageUrl } from "@/lib/utils/serviceImages";

const VOUCHER_ADMIN_LIST_SELECT =
  "id, code, recipient_name, recipient_email, expiry_date, is_redeemed, amount, services(name, duration)";
const VOUCHER_ADMIN_FILTERS = [
  "ALL",
  "ACTIVE",
  "REDEEMED",
  "EXPIRED",
] as const;

export interface VoucherAdminSummary {
  active: number;
  redeemed: number;
  expired: number;
}

export interface VoucherAdminListRow {
  id: string;
  code: string;
  recipient_name: string;
  recipient_email: string;
  expiry_date: string;
  is_redeemed: boolean;
  amount: number;
  services: {
    name: string;
    duration: number;
  } | null;
}

export interface DestructiveVoucherActionResult {
  success: boolean;
  message: string;
  detachedOrderCount: number;
  deletedReviewCount: number;
  deletedVoucherCount: number;
}

interface HardDeleteVoucherRpcRow {
  success: boolean;
  message: string;
  detached_order_count: number;
  deleted_review_count: number;
  deleted_voucher_count: number;
}

function revalidateVoucherAdminData() {
  revalidateTag("dashboard-stats", "max");
  revalidatePath("/admin/dashboard", "page");
  revalidatePath("/admin/vouchers", "page");
  revalidatePath("/admin/purchases", "page");
  revalidatePath("/review/[id]", "page");
}

function createDeleteFailureResult(
  message: string,
): DestructiveVoucherActionResult {
  return {
    success: false,
    message,
    detachedOrderCount: 0,
    deletedReviewCount: 0,
    deletedVoucherCount: 0,
  };
}

function normalizeHardDeleteResult(
  payload: HardDeleteVoucherRpcRow | null | undefined,
): DestructiveVoucherActionResult {
  if (!payload) {
    return createDeleteFailureResult(
      "Fungsi penghapusan voucher permanen belum tersedia di database. Jalankan migration terbaru terlebih dahulu.",
    );
  }

  return {
    success: payload.success,
    message: payload.message,
    detachedOrderCount: payload.detached_order_count,
    deletedReviewCount: payload.deleted_review_count,
    deletedVoucherCount: payload.deleted_voucher_count,
  };
}

async function hardDeleteVoucherTransactional(
  voucherId: string,
): Promise<DestructiveVoucherActionResult> {
  const supabase = getAdminClient();
  const rpc = supabase.rpc as unknown as (
    fn: string,
    args?: Record<string, unknown>,
  ) => Promise<{
    data: HardDeleteVoucherRpcRow[] | null;
    error: { code?: string; message: string } | null;
  }>;
  const { data, error } = await rpc("hard_delete_voucher", {
    target_voucher_id: voucherId,
  });

  if (error) {
    console.error("Error hard deleting voucher transactionally:", error);

    if (error.code === "PGRST202") {
      return createDeleteFailureResult(
        "Fungsi penghapusan voucher permanen belum tersedia di database. Jalankan migration terbaru terlebih dahulu.",
      );
    }

    throw error;
  }

  const payload = Array.isArray(data) ? (data[0] ?? null) : null;
  const result = normalizeHardDeleteResult(payload);

  if (result.success) {
    revalidateVoucherAdminData();
  }

  return result;
}

export async function getVouchersPage(
  params: AdminListParams,
): Promise<AdminPage<VoucherAdminListRow>> {
  await requireAdminPermission(AdminPermission.VOUCHERS_MANAGE);

  const normalized = normalizeAdminListParams(
    {
      page: String(params.page),
      query: params.query,
      filter: params.filter,
    },
    VOUCHER_ADMIN_FILTERS,
  );
  const now = new Date().toISOString();
  const supabase = getAdminClient();
  let request = supabase
    .from("vouchers")
    .select(VOUCHER_ADMIN_LIST_SELECT, { count: "exact" })
    .order("created_at", { ascending: false })
    .order("id", { ascending: false });

  if (normalized.filter === "ACTIVE") {
    request = request.eq("is_redeemed", false).gt("expiry_date", now);
  } else if (normalized.filter === "REDEEMED") {
    request = request.eq("is_redeemed", true);
  } else if (normalized.filter === "EXPIRED") {
    request = request.eq("is_redeemed", false).lte("expiry_date", now);
  }

  if (normalized.query) {
    const pattern = `"%${escapePostgrestLike(normalized.query)}%"`;
    request = request.or(
      `code.ilike.${pattern},recipient_name.ilike.${pattern},recipient_email.ilike.${pattern}`,
    );
  }

  try {
    return await fetchBoundedAdminPage({
      requestedPage: normalized.page,
      fetchRange: async (from, to) => {
        const result = await request.range(from, to);
        return {
          data: (result.data as VoucherAdminListRow[] | null) ?? null,
          count: result.count,
          error: result.error,
        };
      },
    });
  } catch (error) {
    console.error("Error fetching vouchers:", error);
    throw error;
  }
}

export async function getVoucherAdminSummary(): Promise<VoucherAdminSummary> {
  await requireAdminPermission(AdminPermission.VOUCHERS_MANAGE);

  const supabase = getAdminClient();
  const now = new Date().toISOString();
  const [activeResult, redeemedResult, expiredResult] = await Promise.all([
    supabase
      .from("vouchers")
      .select("id", { count: "exact", head: true })
      .eq("is_redeemed", false)
      .gt("expiry_date", now),
    supabase
      .from("vouchers")
      .select("id", { count: "exact", head: true })
      .eq("is_redeemed", true),
    supabase
      .from("vouchers")
      .select("id", { count: "exact", head: true })
      .eq("is_redeemed", false)
      .lte("expiry_date", now),
  ]);

  for (const result of [activeResult, redeemedResult, expiredResult]) {
    if (result.error) {
      console.error("Error counting voucher admin summary:", result.error);
      throw result.error;
    }
  }

  return {
    active: activeResult.count ?? 0,
    redeemed: redeemedResult.count ?? 0,
    expired: expiredResult.count ?? 0,
  };
}

export async function getVoucherByCode(
  code: string,
): Promise<VoucherWithService | null> {
  const supabase = getAdminClient();
  const { data, error } = await supabase
    .from("vouchers")
    .select(`*, services(*)`)
    .eq("code", code.toUpperCase())
    .single();

  if (error) {
    console.error("Error fetching voucher by code:", error);
    return null;
  }

  return data as VoucherWithService;
}

export async function getVoucherById(
  id: string,
): Promise<VoucherWithService | null> {
  const supabase = getAdminClient();
  const { data, error } = await supabase
    .from("vouchers")
    .select(`*, services(*)`)
    .eq("id", id)
    .single();

  if (error) {
    console.error("Error fetching voucher by id:", error);
    return null;
  }

  return data as VoucherWithService;
}

export async function getPublicVoucherLookupByCode(
  code: string,
): Promise<PublicVoucherLookup | null> {
  const voucher = await getVoucherByCode(code);
  if (!voucher) {
    return null;
  }

  return {
    id: voucher.id,
    code: voucher.code,
    recipientName: voucher.recipient_name,
    expiryDate: voucher.expiry_date,
    isRedeemed: voucher.is_redeemed,
    amount: voucher.amount,
    service: {
      name: voucher.services.name,
      duration: voucher.services.duration,
      image: resolveServiceImageUrl(voucher.services.image_url),
    },
  };
}

export async function redeemVoucher(
  code: string,
): Promise<{ success: boolean; message: string }> {
  const access = await requireAdminPermission(AdminPermission.VOUCHERS_MANAGE);

  const supabase = getAdminClient();

  // First, get the voucher
  const { data: voucher, error: fetchError } = await supabase
    .from("vouchers")
    .select("*")
    .eq("code", code.toUpperCase())
    .single();

  if (fetchError || !voucher) {
    return { success: false, message: "Voucher not found." };
  }

  if (voucher.is_redeemed) {
    return { success: false, message: "Voucher has already been redeemed." };
  }

  const now = new Date();
  const expiryDate = new Date(voucher.expiry_date);

  if (expiryDate < now) {
    return { success: false, message: "Voucher has expired." };
  }

  // Redeem the voucher
  const { error: updateError } = await supabase
    .from("vouchers")
    .update({
      is_redeemed: true,
      redeemed_at: now.toISOString(),
    })
    .eq("id", voucher.id);

  if (updateError) {
    console.error("Error redeeming voucher:", updateError);
    return { success: false, message: "Failed to redeem voucher." };
  }

  logAdminAudit(access, {
    action: "voucher.redeem",
    target: voucher.id,
    details: { code: voucher.code },
  });

  revalidateTag("dashboard-stats", "max");
  return { success: true, message: `Voucher ${code} redeemed successfully!` };
}

export async function extendVoucher(
  id: string,
  days: number,
): Promise<boolean> {
  const access = await requireAdminPermission(AdminPermission.VOUCHERS_MANAGE);

  const supabase = getAdminClient();

  const { data: voucher, error: fetchError } = await supabase
    .from("vouchers")
    .select("expiry_date")
    .eq("id", id)
    .single();

  if (fetchError || !voucher) return false;

  const currentExpiry = new Date(voucher.expiry_date);
  currentExpiry.setDate(currentExpiry.getDate() + days);

  const { error } = await supabase
    .from("vouchers")
    .update({ expiry_date: currentExpiry.toISOString() })
    .eq("id", id);

  if (!error) {
    logAdminAudit(access, {
      action: "voucher.extend",
      target: id,
      details: { days },
    });
    revalidateTag("dashboard-stats", "max");
  }
  return !error;
}

export async function voidVoucher(id: string): Promise<boolean> {
  const access = await requireAdminPermission(AdminPermission.VOUCHERS_MANAGE);

  const supabase = getAdminClient();

  // Set expiry to past date to void it
  const { error } = await supabase
    .from("vouchers")
    .update({ expiry_date: new Date("2000-01-01").toISOString() })
    .eq("id", id);

  if (!error) {
    logAdminAudit(access, {
      action: "voucher.void",
      target: id,
    });
    revalidateTag("dashboard-stats", "max");
  }
  return !error;
}

export async function deleteVoucher(
  id: string,
): Promise<DestructiveVoucherActionResult> {
  const access = await requireAdminPermission(AdminPermission.VOUCHERS_MANAGE);

  const normalizedId = id.trim();
  if (!normalizedId) {
    return createDeleteFailureResult("ID voucher tidak valid.");
  }

  const result = await hardDeleteVoucherTransactional(normalizedId);

  if (result.success) {
    logAdminAudit(access, {
      action: "voucher.hard_delete",
      target: normalizedId,
      details: {
        detachedOrderCount: result.detachedOrderCount,
        deletedReviewCount: result.deletedReviewCount,
        deletedVoucherCount: result.deletedVoucherCount,
      },
    });
  }

  return result;
}
