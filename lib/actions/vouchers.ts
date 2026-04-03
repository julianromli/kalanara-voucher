"use server";

import crypto from "crypto";
import { revalidatePath, revalidateTag } from "next/cache";
import { AdminPermission } from "@/lib/auth/admin-rbac";
import {
  logAdminAudit,
  requireAdminPermission,
} from "@/lib/auth/admin-rbac-server";
import { getAdminClient } from "@/lib/supabase/admin";
import type {
  Database,
  Voucher,
  VoucherInsert,
  VoucherWithService,
} from "@/lib/database.types";
import type { PublicVoucherLookup } from "@/lib/types";
import { resolveServiceImageUrl } from "@/lib/utils/serviceImages";

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

/**
 * Generates a cryptographically secure voucher code.
 * Uses crypto.randomBytes() instead of Math.random() for security.
 * Format: KSP-{YEAR}-{8 random alphanumeric characters}
 */
function generateVoucherCode(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  const randomBytes = crypto.randomBytes(8);
  const randomPart = Array.from(
    { length: 8 },
    (_, i) => chars[randomBytes[i] % chars.length],
  ).join("");
  const year = new Date().getFullYear();
  return `KSP-${year}-${randomPart}`;
}

export async function getVouchers(): Promise<VoucherWithService[]> {
  await requireAdminPermission(AdminPermission.VOUCHERS_MANAGE);

  const supabase = getAdminClient();
  const { data, error } = await supabase
    .from("vouchers")
    .select(`*, services(*)`)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching vouchers:", error);
    return [];
  }

  return (data as VoucherWithService[]) || [];
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

export async function getVoucherBySourceOrderId(
  sourceOrderId: string,
): Promise<VoucherWithService | null> {
  const supabase = getAdminClient();
  const { data, error } = await supabase
    .from("vouchers")
    .select("*, services(*)")
    .eq("source_order_id", sourceOrderId)
    .single();

  if (error) {
    if ("code" in error && error.code === "PGRST116") {
      return null;
    }

    console.error("Error fetching voucher by source order ID:", error);
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

export async function createVoucher(
  voucherData: Omit<VoucherInsert, "code">,
): Promise<Voucher | null> {
  // Use admin client to bypass RLS for trusted server operations
  const supabase = getAdminClient();

  // Generate unique code
  let code = generateVoucherCode();
  let attempts = 0;
  const maxAttempts = 5;

  while (attempts < maxAttempts) {
    const { data: existing } = await supabase
      .from("vouchers")
      .select("id")
      .eq("code", code)
      .single();

    if (!existing) break;
    code = generateVoucherCode();
    attempts++;
  }

  const { data, error } = await supabase
    .from("vouchers")
    .insert({
      ...voucherData,
      code,
    } as Database["public"]["Tables"]["vouchers"]["Insert"])
    .select()
    .single();

  if (error) {
    if (
      voucherData.source_order_id &&
      "code" in error &&
      error.code === "23505"
    ) {
      const existingVoucher = await getVoucherBySourceOrderId(
        voucherData.source_order_id,
      );
      return existingVoucher;
    }

    console.error("Error creating voucher:", error);
    return null;
  }

  revalidateTag("dashboard-stats", "max");
  return data as Voucher;
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
