import "server-only";

import { z } from "zod";
import { AdminPermission } from "@/lib/auth/admin-rbac";
import {
  logAdminAudit,
  requireAdminPermission,
} from "@/lib/auth/admin-rbac-server";
import {
  renderVoucherEmailHtml,
  sendVoucherEmailMessage,
  voucherBuyerCopySubject,
  voucherGiftSubject,
  type VoucherEmailContent,
} from "@/lib/email/voucher-email";
import {
  isValidEmailAddress,
  normalizeEmailAddress,
  sameEmailAddress,
} from "@/lib/email-address";
import { getAdminClient } from "@/lib/supabase/admin";
import type {
  ResendFailureStatus,
  VoucherDeliveryOverview,
} from "@/lib/voucher-resend/shared";

// Postgres accepts any 8-4-4-4-12 hex id; seeded rows fail the RFC version
// check of z.string().uuid() (see #50), so use z.guid().
export const idSchema = z.guid();
export const requestIdSchema = z.guid();
export const targetSchema = z.enum(["RECIPIENT", "BUYER", "CUSTOM"]);
export const whatsAppTargetSchema = z.enum(["RECIPIENT", "BUYER"]);

export type Failure = { status: ResendFailureStatus; retryAfterSeconds?: number | null };

export interface OrderRow {
  id: string;
  payment_status: string;
  customer_name: string;
  customer_email: string | null;
  customer_phone: string | null;
  voucher_id: string | null;
  send_to: string | null;
  recipient_phone: string | null;
}

export interface ItemRow {
  id: string;
  voucher_id: string | null;
  send_to: string | null;
  recipient_phone: string | null;
  sort_order: number | null;
}

export interface VoucherRow {
  id: string;
  code: string;
  recipient_name: string;
  recipient_email: string | null;
  sender_name: string;
  sender_message: string | null;
  amount: number;
  expiry_date: string;
  is_redeemed: boolean;
  services: { name: string; duration: number } | null;
}

const ORDER_SELECT =
  "id, payment_status, customer_name, customer_email, customer_phone, voucher_id, send_to, recipient_phone";
const ITEM_SELECT = "id, voucher_id, send_to, recipient_phone, sort_order";
export const VOUCHER_SELECT =
  "id, code, recipient_name, recipient_email, sender_name, sender_message, amount, expiry_date, is_redeemed, services(name, duration)";

export function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function numberOrNull(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export async function loadOrderContext(orderId: string) {
  const supabase = getAdminClient();
  const [orderResult, itemsResult] = await Promise.all([
    supabase.from("orders").select(ORDER_SELECT).eq("id", orderId).maybeSingle(),
    supabase.from("order_items").select(ITEM_SELECT).eq("order_id", orderId),
  ]);
  if (orderResult.error) throw orderResult.error;
  if (itemsResult.error) throw itemsResult.error;
  const order = orderResult.data as OrderRow | null;
  if (!order) return { status: "not_found" as const };
  const items = ((itemsResult.data ?? []) as ItemRow[])
    .slice()
    .sort((left, right) => (left.sort_order ?? 0) - (right.sort_order ?? 0));
  return { status: "ok" as const, order, items };
}

export function whatsAppTargetFor(
  order: OrderRow,
  item: ItemRow | null
): VoucherDeliveryOverview["whatsAppTarget"] {
  const sendTo = item?.send_to ?? order.send_to;
  const recipientPhone = item?.recipient_phone ?? order.recipient_phone;
  if (sendTo === "RECIPIENT" && recipientPhone) {
    return { kind: "RECIPIENT", phone: recipientPhone };
  }
  return order.customer_phone ? { kind: "BUYER", phone: order.customer_phone } : null;
}

export function isExpired(voucher: Pick<VoucherRow, "expiry_date">, now = Date.now()): boolean {
  return Date.parse(voucher.expiry_date) <= now;
}

export async function loadVoucher(voucherId: string) {
  const { data, error } = await getAdminClient()
    .from("vouchers")
    .select(VOUCHER_SELECT)
    .eq("id", voucherId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return { status: "not_found" as const };
  return { status: "ok" as const, voucher: data as unknown as VoucherRow };
}

function emailContent(order: OrderRow, voucher: VoucherRow): VoucherEmailContent {
  return {
    orderId: order.id,
    voucherCode: voucher.code,
    recipientEmail: voucher.recipient_email,
    recipientName: voucher.recipient_name,
    senderName: voucher.sender_name,
    senderMessage: voucher.sender_message,
    serviceName: voucher.services?.name ?? "Kalanara Spa",
    serviceDuration: voucher.services?.duration ?? 0,
    amount: voucher.amount,
    expiryDate: voucher.expiry_date,
  };
}

export function beginFailure(body: Record<string, unknown> | null): Failure {
  const status = typeof body?.status === "string" ? body.status : "error";
  const known: ResendFailureStatus[] = [
    "invalid",
    "not_found",
    "not_paid",
    "redeemed",
    "expired",
    "cooldown",
    "rate_limited",
  ];
  return {
    status: known.includes(status as ResendFailureStatus)
      ? (status as ResendFailureStatus)
      : "error",
    retryAfterSeconds: numberOrNull(body?.retry_after_seconds),
  };
}

export type ResendVoucherEmailResult =
  | { status: "sent"; to: string; recipientEmailUpdated: boolean }
  | { status: "sent_not_logged"; to: string }
  | Failure;

export async function resendVoucherEmailForAdmin(input: {
  orderId: string;
  voucherId: string;
  target: "RECIPIENT" | "BUYER" | "CUSTOM";
  email?: string;
  saveAsRecipient?: boolean;
  requestId?: string;
}): Promise<ResendVoucherEmailResult> {
  const access = await requireAdminPermission(AdminPermission.ORDERS_RESEND_VOUCHER);
  const target = targetSchema.safeParse(input.target);
  if (
    !idSchema.safeParse(input.orderId).success ||
    !idSchema.safeParse(input.voucherId).success ||
    !target.success ||
    (input.requestId !== undefined && !requestIdSchema.safeParse(input.requestId).success)
  ) {
    return { status: "invalid" };
  }
  const customEmail =
    target.data === "CUSTOM" ? normalizeEmailAddress(input.email ?? "") : null;
  if (target.data === "CUSTOM" && (!customEmail || !isValidEmailAddress(customEmail))) {
    return { status: "invalid_email" };
  }

  const context = await loadOrderContext(input.orderId);
  if (context.status !== "ok") return { status: context.status };
  const loaded = await loadVoucher(input.voucherId);
  if (loaded.status !== "ok") return { status: loaded.status };
  const { order } = context;
  const { voucher } = loaded;

  const rawTo =
    target.data === "CUSTOM"
      ? customEmail
      : target.data === "BUYER"
        ? order.customer_email
        : voucher.recipient_email;
  const to = rawTo ? normalizeEmailAddress(rawTo) : "";
  if (!to) return { status: "no_address" };
  if (!isValidEmailAddress(to)) return { status: "invalid_email" };

  const supabase = getAdminClient();
  const { data: begun, error: beginError } = await supabase.rpc("voucher_resend_begin", {
    p_voucher_id: voucher.id,
    p_order_id: order.id,
    p_channel: "EMAIL",
    p_target_kind: target.data,
    p_target_email: to,
    p_target_phone: null,
    p_save_as_recipient: target.data === "CUSTOM" && input.saveAsRecipient === true,
    p_requested_by: access.userId,
    p_requested_by_email: access.email,
    p_requested_by_role: access.role,
  });
  if (beginError) throw beginError;
  const beginBody = asRecord(begun);
  const resendId = typeof beginBody?.resend_id === "string" ? beginBody.resend_id : null;
  if (beginBody?.status !== "ok" || !resendId) return beginFailure(beginBody);

  const content = emailContent(order, voucher);
  // A buyer who bought for someone else gets the buyer copy, not "you got a
  // gift" addressed to the recipient.
  const buyerCopy =
    target.data === "BUYER" &&
    Boolean(voucher.recipient_email) &&
    !sameEmailAddress(voucher.recipient_email, order.customer_email);
  let sendResult: Awaited<ReturnType<typeof sendVoucherEmailMessage>>;
  try {
    sendResult = await sendVoucherEmailMessage({
      delivery: content,
      to,
      subject: buyerCopy ? voucherBuyerCopySubject(content) : voucherGiftSubject(content),
      html: buyerCopy
        ? renderVoucherEmailHtml(content, {
            variant: "buyer_copy",
            recipientEmail: voucher.recipient_email,
          })
        : renderVoucherEmailHtml(content),
      // A retry of the same dialog submission (after a dropped connection)
      // reuses the request id, so Resend drops the duplicate.
      idempotencyKey: `voucher-resend-${input.requestId ?? resendId}`,
    });
  } catch (error) {
    sendResult = {
      ok: false,
      reason: "network",
      message: error instanceof Error ? error.message : "Unknown send error",
    };
  }

  const { data: finished, error: finishError } = await supabase.rpc("voucher_resend_finish", {
    p_resend_id: resendId,
    p_sent: sendResult.ok,
    p_provider_message_id: sendResult.ok ? sendResult.messageId : null,
    p_error: sendResult.ok ? null : `${sendResult.reason}: ${sendResult.message}`,
  });
  const finishBody = asRecord(finished);

  logAdminAudit(access, {
    action: sendResult.ok ? "orders.voucher_resend" : "orders.voucher_resend_failed",
    target: voucher.id,
    details: { orderId: order.id, resendId, targetKind: target.data },
  });

  if (!sendResult.ok) {
    return {
      status:
        sendResult.reason === "pdf"
          ? "pdf_error"
          : sendResult.reason === "network"
            ? "network"
            : "provider_error",
    };
  }
  if (finishError || finishBody?.status !== "ok") {
    return { status: "sent_not_logged", to };
  }
  return {
    status: "sent",
    to,
    recipientEmailUpdated: finishBody.recipient_email_updated === true,
  };
}

