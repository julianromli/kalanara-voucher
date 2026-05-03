import "server-only";

import { getAdminClient } from "@/lib/supabase/admin";
import type {
  DiscountCode,
  DiscountCodeInsert,
  DiscountCodeRedemption,
  DiscountCodeRedemptionInsert,
  DiscountCodeRedemptionUpdate,
  DiscountCodeUpdate,
} from "@/lib/database.types";

export const DISCOUNT_TYPES = ["FIXED_AMOUNT", "PERCENTAGE"] as const;
export const DISCOUNT_REDEMPTION_STATUSES = [
  "PENDING",
  "SUCCEEDED",
  "VOID",
] as const;

export type DiscountType = (typeof DISCOUNT_TYPES)[number];
export type DiscountRedemptionStatus =
  (typeof DISCOUNT_REDEMPTION_STATUSES)[number];

export type DiscountValidationReason =
  | "INVALID"
  | "INACTIVE"
  | "NOT_STARTED"
  | "EXPIRED"
  | "GLOBAL_LIMIT_REACHED"
  | "CUSTOMER_LIMIT_REACHED";

export interface DiscountQuote {
  discountCodeId: string;
  code: string;
  discountType: DiscountType;
  discountValue: number;
  subtotalAmount: number;
  discountAmount: number;
  totalAmount: number;
}

export type DiscountValidationResult =
  | {
      valid: true;
      quote: DiscountQuote;
    }
  | {
      valid: false;
      reason: DiscountValidationReason;
      message: string;
    };

export interface DiscountCodeFormInput {
  code: string;
  discountType: DiscountType;
  discountValue: number;
  isActive: boolean;
  startsAt?: string | null;
  endsAt?: string | null;
  maxTotalUses?: number | null;
  maxUsesPerCustomer?: number | null;
}

export interface DiscountCodeWithStats extends DiscountCode {
  successful_redemption_count: number;
}

interface DiscountRedemptionStatusRow {
  status: string;
}

interface DiscountRedemptionLimitRow {
  customer_email_normalized: string;
  customer_phone_normalized: string;
}

interface PendingDiscountRedemptionInput {
  discountCodeId: string;
  orderId: string;
  customerEmail: string;
  customerPhone: string;
  discountType: DiscountType;
  discountValue: number;
  subtotalAmount: number;
  discountAmount: number;
  totalAmount: number;
}

type NormalizedDiscountCode = Omit<DiscountCode, "discount_type"> & {
  discount_type: DiscountType;
};

function isDiscountType(value: string): value is DiscountType {
  return DISCOUNT_TYPES.includes(value as DiscountType);
}

function buildInvalidResult(
  reason: DiscountValidationReason,
  message: string
): DiscountValidationResult {
  return { valid: false, reason, message };
}

function toOptionalDateString(value?: string | null) {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

function normalizeLimit(value?: number | null) {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return null;
  }

  return value >= 0 ? Math.floor(value) : null;
}

function parseDateOrThrow(value: string, fieldLabel: string) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`${fieldLabel} tidak valid.`);
  }

  return parsed.toISOString();
}

function normalizeDiscountCodeRecord(
  record: DiscountCode | null
): NormalizedDiscountCode | null {
  if (!record || !isDiscountType(record.discount_type)) {
    return null;
  }

  return {
    ...record,
    discount_type: record.discount_type,
  };
}

function getDiscountValueNumber(value: number) {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return value;
}

export function normalizeDiscountCode(code: string) {
  return code.trim().toUpperCase();
}

export function normalizeCustomerEmail(email: string) {
  return email.trim().toLowerCase();
}

export function normalizeCustomerPhone(phone: string) {
  const digits = phone.replace(/\D/g, "");

  if (digits.startsWith("0")) {
    return `62${digits.slice(1)}`;
  }

  if (digits.startsWith("62")) {
    return digits;
  }

  return digits;
}

export function calculateDiscountAmount(
  subtotalAmount: number,
  discountType: DiscountType,
  discountValue: number
) {
  const normalizedSubtotal = Math.max(0, Math.round(subtotalAmount));
  const normalizedValue = Math.max(0, getDiscountValueNumber(discountValue));
  const rawDiscount =
    discountType === "FIXED_AMOUNT"
      ? Math.round(normalizedValue)
      : Math.round((normalizedSubtotal * normalizedValue) / 100);

  return Math.min(normalizedSubtotal, Math.max(0, rawDiscount));
}

export function allocateDiscountAcrossItems(
  originalUnitPrices: readonly number[],
  discountAmount: number
) {
  if (originalUnitPrices.length === 0) {
    return [];
  }

  const normalizedPrices = originalUnitPrices.map((value) =>
    Math.max(0, Math.round(value))
  );
  const subtotalAmount = normalizedPrices.reduce((sum, value) => sum + value, 0);
  const normalizedDiscount = Math.max(0, Math.min(Math.round(discountAmount), subtotalAmount));

  if (normalizedDiscount === 0 || subtotalAmount === 0) {
    return normalizedPrices.map(() => 0);
  }

  let remaining = normalizedDiscount;

  return normalizedPrices.map((price, index) => {
    if (index === normalizedPrices.length - 1) {
      return remaining;
    }

    const allocated = Math.floor((normalizedDiscount * price) / subtotalAmount);
    remaining -= allocated;
    return allocated;
  });
}

export async function validateDiscountForCheckout(input: {
  discountCode: string;
  subtotalAmount: number;
  customerEmail: string;
  customerPhone: string;
  now?: Date;
}): Promise<DiscountValidationResult> {
  const normalizedCode = normalizeDiscountCode(input.discountCode);
  if (!normalizedCode) {
    return buildInvalidResult("INVALID", "Kode diskon tidak valid.");
  }

  const supabase = getAdminClient();
  const { data, error } = await supabase
    .from("discount_codes")
    .select("*")
    .eq("normalized_code", normalizedCode)
    .maybeSingle();

  if (error) {
    console.error("Error loading discount code:", error);
    throw new Error("Gagal memuat kode diskon.");
  }

  const discountCode = normalizeDiscountCodeRecord(data);
  if (!discountCode) {
    return buildInvalidResult("INVALID", "Kode diskon tidak ditemukan.");
  }

  if (!discountCode.is_active) {
    return buildInvalidResult("INACTIVE", "Kode diskon sedang tidak aktif.");
  }

  const now = input.now ?? new Date();
  if (discountCode.starts_at && now < new Date(discountCode.starts_at)) {
    return buildInvalidResult("NOT_STARTED", "Kode diskon belum berlaku.");
  }

  if (discountCode.ends_at && now > new Date(discountCode.ends_at)) {
    return buildInvalidResult("EXPIRED", "Kode diskon sudah kedaluwarsa.");
  }

  const { data: successfulRedemptions, error: redemptionsError } = await supabase
    .from("discount_code_redemptions")
    .select("customer_email_normalized, customer_phone_normalized")
    .eq("discount_code_id", discountCode.id)
    .eq("status", "SUCCEEDED");

  if (redemptionsError) {
    console.error("Error loading discount redemptions:", redemptionsError);
    throw new Error("Gagal memeriksa kuota kode diskon.");
  }

  const redemptionRows =
    (successfulRedemptions as DiscountRedemptionLimitRow[] | null) ?? [];

  if (
    discountCode.max_total_uses !== null &&
    redemptionRows.length >= discountCode.max_total_uses
  ) {
    return buildInvalidResult(
      "GLOBAL_LIMIT_REACHED",
      "Kuota kode diskon sudah habis."
    );
  }

  const normalizedEmail = normalizeCustomerEmail(input.customerEmail);
  const normalizedPhone = normalizeCustomerPhone(input.customerPhone);
  const customerUseCount = redemptionRows.filter(
    (row) =>
      row.customer_email_normalized === normalizedEmail ||
      row.customer_phone_normalized === normalizedPhone
  ).length;

  if (
    discountCode.max_uses_per_customer !== null &&
    customerUseCount >= discountCode.max_uses_per_customer
  ) {
    return buildInvalidResult(
      "CUSTOMER_LIMIT_REACHED",
      "Kode diskon sudah pernah dipakai untuk email atau nomor ini."
    );
  }

  const discountAmount = calculateDiscountAmount(
    input.subtotalAmount,
    discountCode.discount_type,
    discountCode.discount_value
  );

  return {
    valid: true,
    quote: {
      discountCodeId: discountCode.id,
      code: discountCode.code,
      discountType: discountCode.discount_type,
      discountValue: discountCode.discount_value,
      subtotalAmount: Math.max(0, Math.round(input.subtotalAmount)),
      discountAmount,
      totalAmount: Math.max(
        0,
        Math.round(input.subtotalAmount) - discountAmount
      ),
    },
  };
}

export async function createPendingDiscountRedemption(
  input: PendingDiscountRedemptionInput
) {
  const supabase = getAdminClient();
  const payload: DiscountCodeRedemptionInsert = {
    discount_code_id: input.discountCodeId,
    order_id: input.orderId,
    customer_email_normalized: normalizeCustomerEmail(input.customerEmail),
    customer_phone_normalized: normalizeCustomerPhone(input.customerPhone),
    status: "PENDING",
    discount_snapshot_type: input.discountType,
    discount_snapshot_value: input.discountValue,
    subtotal_amount: input.subtotalAmount,
    discount_amount: input.discountAmount,
    final_total_amount: input.totalAmount,
  };

  const { data, error } = await supabase
    .from("discount_code_redemptions")
    .insert(payload)
    .select()
    .single();

  if (error) {
    console.error("Error creating pending discount redemption:", error);
    return null;
  }

  return data as DiscountCodeRedemption;
}

async function getDiscountRedemptionStatus(orderId: string) {
  const supabase = getAdminClient();
  const { data, error } = await supabase
    .from("discount_code_redemptions")
    .select("status")
    .eq("order_id", orderId)
    .maybeSingle();

  if (error) {
    console.error("Error loading discount redemption status:", error);
    return null;
  }

  return (data as DiscountRedemptionStatusRow | null)?.status ?? null;
}

export async function markDiscountRedemptionSucceeded(orderId: string) {
  const supabase = getAdminClient();
  const redeemedAt = new Date().toISOString();
  const updatePayload: DiscountCodeRedemptionUpdate = {
    status: "SUCCEEDED",
    redeemed_at: redeemedAt,
  };
  const { data, error } = await supabase
    .from("discount_code_redemptions")
    .update(updatePayload)
    .eq("order_id", orderId)
    .eq("status", "PENDING")
    .select("id");

  if (error) {
    console.error("Error marking discount redemption succeeded:", error);
    return false;
  }

  if ((data ?? []).length > 0) {
    return true;
  }

  const currentStatus = await getDiscountRedemptionStatus(orderId);
  return currentStatus === null || currentStatus === "SUCCEEDED";
}

export async function markDiscountRedemptionVoid(orderId: string) {
  const supabase = getAdminClient();
  const updatePayload: DiscountCodeRedemptionUpdate = {
    status: "VOID",
    redeemed_at: null,
  };
  const { data, error } = await supabase
    .from("discount_code_redemptions")
    .update(updatePayload)
    .eq("order_id", orderId)
    .eq("status", "PENDING")
    .select("id");

  if (error) {
    console.error("Error marking discount redemption void:", error);
    return false;
  }

  if ((data ?? []).length > 0) {
    return true;
  }

  const currentStatus = await getDiscountRedemptionStatus(orderId);
  return (
    currentStatus === null ||
    currentStatus === "VOID" ||
    currentStatus === "SUCCEEDED"
  );
}

export async function getDiscountCodesWithStats() {
  const supabase = getAdminClient();
  const [{ data: codes, error: codesError }, { data: redemptions, error: redemptionsError }] =
    await Promise.all([
      supabase.from("discount_codes").select("*").order("created_at", { ascending: false }),
      supabase
        .from("discount_code_redemptions")
        .select("discount_code_id")
        .eq("status", "SUCCEEDED"),
    ]);

  if (codesError) {
    console.error("Error fetching discount codes:", codesError);
    return [];
  }

  if (redemptionsError) {
    console.error("Error fetching discount redemption stats:", redemptionsError);
    return [];
  }

  const countsByCodeId = new Map<string, number>();
  (redemptions ?? []).forEach((row) => {
    const current = countsByCodeId.get(row.discount_code_id) ?? 0;
    countsByCodeId.set(row.discount_code_id, current + 1);
  });

  return ((codes ?? []) as DiscountCode[]).map((code) => ({
    ...code,
    successful_redemption_count: countsByCodeId.get(code.id) ?? 0,
  })) satisfies DiscountCodeWithStats[];
}

function normalizeDiscountCodeFormInput(input: DiscountCodeFormInput) {
  const normalizedCode = normalizeDiscountCode(input.code);
  if (!normalizedCode) {
    throw new Error("Kode diskon wajib diisi.");
  }

  if (!isDiscountType(input.discountType)) {
    throw new Error("Tipe diskon tidak valid.");
  }

  const discountValue = getDiscountValueNumber(input.discountValue);
  if (!Number.isFinite(discountValue) || discountValue < 0) {
    throw new Error("Nilai diskon harus berupa angka 0 atau lebih.");
  }

  const startsAt = toOptionalDateString(input.startsAt);
  const endsAt = toOptionalDateString(input.endsAt);

  const normalizedStartsAt = startsAt
    ? parseDateOrThrow(startsAt, "Tanggal mulai")
    : null;
  const normalizedEndsAt = endsAt
    ? parseDateOrThrow(endsAt, "Tanggal berakhir")
    : null;

  if (
    normalizedStartsAt &&
    normalizedEndsAt &&
    new Date(normalizedStartsAt) > new Date(normalizedEndsAt)
  ) {
    throw new Error("Tanggal mulai harus sebelum atau sama dengan tanggal berakhir.");
  }

  return {
    code: normalizedCode,
    normalized_code: normalizedCode,
    discount_type: input.discountType,
    discount_value: discountValue,
    is_active: input.isActive,
    starts_at: normalizedStartsAt,
    ends_at: normalizedEndsAt,
    max_total_uses: normalizeLimit(input.maxTotalUses),
    max_uses_per_customer: normalizeLimit(input.maxUsesPerCustomer),
  };
}

function toFriendlyDiscountWriteError(error: {
  code?: string;
  message?: string;
}) {
  if (error.code === "23505") {
    return "Kode diskon sudah digunakan. Pakai kode lain.";
  }

  return error.message || "Gagal menyimpan kode diskon.";
}

export async function createDiscountCodeRecord(input: DiscountCodeFormInput) {
  const supabase = getAdminClient();
  const payload: DiscountCodeInsert = normalizeDiscountCodeFormInput(input);

  const { data, error } = await supabase
    .from("discount_codes")
    .insert(payload)
    .select()
    .single();

  if (error) {
    throw new Error(toFriendlyDiscountWriteError(error));
  }

  return data as DiscountCode;
}

export async function updateDiscountCodeRecord(
  id: string,
  input: DiscountCodeFormInput
) {
  const supabase = getAdminClient();
  const payload: DiscountCodeUpdate = normalizeDiscountCodeFormInput(input);

  const { data, error } = await supabase
    .from("discount_codes")
    .update(payload)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    throw new Error(toFriendlyDiscountWriteError(error));
  }

  return data as DiscountCode;
}

export async function setDiscountCodeActiveStateRecord(
  id: string,
  isActive: boolean
) {
  const supabase = getAdminClient();
  const { data, error } = await supabase
    .from("discount_codes")
    .update({ is_active: isActive })
    .eq("id", id)
    .select()
    .single();

  if (error) {
    throw new Error("Gagal mengubah status kode diskon.");
  }

  return data as DiscountCode;
}
