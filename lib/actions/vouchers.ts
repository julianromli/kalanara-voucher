"use server";

import crypto from "crypto";
import { createClient } from "@/lib/supabase/server";
import { getAdminClient } from "@/lib/supabase/admin";
import { revalidateTag } from "next/cache";
import type {
  Database,
  Voucher,
  VoucherInsert,
  VoucherWithService,
} from "@/lib/database.types";

/**
 * Generates a cryptographically secure voucher code.
 * Uses crypto.randomBytes() instead of Math.random() for security.
 * Format: KSP-{YEAR}-{12 random alphanumeric characters}
 */
function generateVoucherCode(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  const randomBytes = crypto.randomBytes(12);
  const randomPart = Array.from(
    { length: 12 },
    (_, i) => chars[randomBytes[i] % chars.length]
  ).join("");
  const year = new Date().getFullYear();
  return `KSP-${year}-${randomPart}`;
}

export async function getVouchers(): Promise<VoucherWithService[]> {
  const supabase = await createClient();
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
  code: string
): Promise<VoucherWithService | null> {
  const supabase = await createClient();
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
  id: string
): Promise<VoucherWithService | null> {
  const supabase = await createClient();
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

export async function createVoucher(
  voucherData: Omit<VoucherInsert, "code">
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
    .insert({ ...voucherData, code } as Database["public"]["Tables"]["vouchers"]["Insert"])
    .select()
    .single();

  if (error) {
    console.error("Error creating voucher:", error);
    return null;
  }

  revalidateTag("dashboard-stats", "max");
  return data as Voucher;
}

export async function redeemVoucher(
  code: string
): Promise<{ success: boolean; message: string }> {
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

  revalidateTag("dashboard-stats", "max");
  return { success: true, message: `Voucher ${code} redeemed successfully!` };
}

export async function extendVoucher(
  id: string,
  days: number
): Promise<boolean> {
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

  if (!error) revalidateTag("dashboard-stats", "max");
  return !error;
}

export async function voidVoucher(id: string): Promise<boolean> {
  const supabase = getAdminClient();

  // Set expiry to past date to void it
  const { error } = await supabase
    .from("vouchers")
    .update({ expiry_date: new Date("2000-01-01").toISOString() })
    .eq("id", id);

  if (!error) revalidateTag("dashboard-stats", "max");
  return !error;
}
