"use server";

import { AdminPermission } from "@/lib/auth/admin-rbac";
import {
  logAdminAudit,
  requireAdminPermission,
} from "@/lib/auth/admin-rbac-server";
import { getAdminClient } from "@/lib/supabase/admin";
import { generateWhatsAppUrl } from "@/lib/utils/whatsapp";
import {
  asRecord,
  beginFailure,
  idSchema,
  isExpired,
  loadOrderContext,
  loadVoucher,
  whatsAppTargetFor,
  whatsAppTargetSchema,
  VOUCHER_SELECT,
  type Failure,
  type ItemRow,
  type VoucherRow,
} from "@/lib/voucher-resend/server";
import type {
  EmailDeliveryState,
  VoucherDeliveryOverview,
} from "@/lib/voucher-resend/shared";

// The email resend runs in /api/admin/vouchers/resend so the PDF assets are
// traced into that function (see lib/voucher-pdf-assets.ts).

export async function getVoucherDeliveryOverview(
  orderId: string
): Promise<{ status: "ok"; vouchers: VoucherDeliveryOverview[] } | Failure> {
  await requireAdminPermission(AdminPermission.ORDERS_VIEW);
  if (!idSchema.safeParse(orderId).success) return { status: "invalid" };

  const context = await loadOrderContext(orderId);
  if (context.status !== "ok") return { status: context.status };
  const { order, items } = context;

  const pairs: Array<{ voucherId: string; item: ItemRow | null }> =
    items.length > 0
      ? items
          .filter((item) => item.voucher_id)
          .map((item) => ({ voucherId: item.voucher_id!, item }))
      : order.voucher_id
        ? [{ voucherId: order.voucher_id, item: null }]
        : [];
  if (pairs.length === 0) return { status: "ok", vouchers: [] };

  const voucherIds = pairs.map((pair) => pair.voucherId);
  const supabase = getAdminClient();
  const [vouchersResult, outboxResult, resendsResult] = await Promise.all([
    supabase.from("vouchers").select(VOUCHER_SELECT).in("id", voucherIds),
    supabase
      .from("voucher_delivery_outbox")
      .select("voucher_id, channel, status, sent_at, updated_at")
      .in("voucher_id", voucherIds)
      .eq("channel", "EMAIL"),
    supabase
      .from("voucher_delivery_resends")
      .select("voucher_id, status, target_email, created_at, finished_at, requested_by_email")
      .in("voucher_id", voucherIds)
      .eq("channel", "EMAIL")
      .order("created_at", { ascending: false }),
  ]);
  if (vouchersResult.error || outboxResult.error || resendsResult.error) {
    return { status: "error" };
  }

  const vouchers = new Map(
    ((vouchersResult.data ?? []) as unknown as VoucherRow[]).map((row) => [row.id, row])
  );
  const outbox = new Map<string, { status: string; sent_at: string | null; updated_at: string }>();
  for (const row of (outboxResult.data ?? []) as Array<{
    voucher_id: string;
    status: string;
    sent_at: string | null;
    updated_at: string;
  }>) {
    outbox.set(row.voucher_id, row);
  }
  const lastResend = new Map<
    string,
    { status: string; target_email: string | null; created_at: string; finished_at: string | null; requested_by_email: string | null }
  >();
  for (const row of (resendsResult.data ?? []) as Array<{
    voucher_id: string;
    status: string;
    target_email: string | null;
    created_at: string;
    finished_at: string | null;
    requested_by_email: string | null;
  }>) {
    if (!lastResend.has(row.voucher_id)) lastResend.set(row.voucher_id, row);
  }

  const now = Date.now();
  const overview: VoucherDeliveryOverview[] = [];
  for (const pair of pairs) {
    const voucher = vouchers.get(pair.voucherId);
    if (!voucher) continue;
    const email = outbox.get(voucher.id);
    const emailState: EmailDeliveryState = !email
      ? "NONE"
      : email.status === "SENT"
        ? "SENT"
        : email.status === "FAILED"
          ? "FAILED"
          : "PENDING";
    const resend = lastResend.get(voucher.id);
    overview.push({
      voucherId: voucher.id,
      orderItemId: pair.item?.id ?? null,
      code: voucher.code,
      serviceName: voucher.services?.name ?? null,
      recipientName: voucher.recipient_name,
      recipientEmail: voucher.recipient_email,
      buyerEmail: order.customer_email,
      whatsAppTarget: whatsAppTargetFor(order, pair.item),
      isRedeemed: voucher.is_redeemed,
      isExpired: isExpired(voucher, now),
      email: {
        state: emailState,
        at: email ? (email.sent_at ?? email.updated_at) : null,
      },
      lastResend: resend
        ? {
            status:
              resend.status === "SENT" || resend.status === "FAILED" ? resend.status : "PENDING",
            to: resend.target_email,
            at: resend.finished_at ?? resend.created_at,
            by: resend.requested_by_email,
          }
        : null,
    });
  }

  return { status: "ok", vouchers: overview };
}

export type VoucherWhatsAppLinkResult = { status: "ok"; url: string } | Failure;

// Builds a wa.me link for the admin to send from their own WhatsApp. Nothing is
// sent from the server; the copy is logged as COPIED.
export async function getVoucherWhatsAppLink(input: {
  orderId: string;
  voucherId: string;
  target: "RECIPIENT" | "BUYER";
}): Promise<VoucherWhatsAppLinkResult> {
  const access = await requireAdminPermission(AdminPermission.ORDERS_RESEND_VOUCHER);
  const target = whatsAppTargetSchema.safeParse(input.target);
  if (
    !idSchema.safeParse(input.orderId).success ||
    !idSchema.safeParse(input.voucherId).success ||
    !target.success
  ) {
    return { status: "invalid" };
  }

  const context = await loadOrderContext(input.orderId);
  if (context.status !== "ok") return { status: context.status };
  const loaded = await loadVoucher(input.voucherId);
  if (loaded.status !== "ok") return { status: loaded.status };
  const { order, items } = context;
  const { voucher } = loaded;
  const item = items.find((entry) => entry.voucher_id === voucher.id) ?? null;
  const resolved = whatsAppTargetFor(order, item);
  const phone =
    target.data === "BUYER"
      ? order.customer_phone
      : resolved?.kind === "RECIPIENT"
        ? resolved.phone
        : null;
  if (!phone) return { status: "no_phone" };

  const { data: begun, error } = await getAdminClient().rpc("voucher_resend_begin", {
    p_voucher_id: voucher.id,
    p_order_id: order.id,
    p_channel: "WHATSAPP_LINK",
    p_target_kind: target.data,
    p_target_email: null,
    p_target_phone: phone,
    p_save_as_recipient: false,
    p_requested_by: access.userId,
    p_requested_by_email: access.email,
    p_requested_by_role: access.role,
  });
  if (error) return { status: "error" };
  const body = asRecord(begun);
  if (body?.status !== "ok") return beginFailure(body);

  const appUrl = (process.env.NEXT_PUBLIC_APP_URL?.trim() || "https://voucher.kalanaraspa.com").replace(/\/+$/, "");
  const url = generateWhatsAppUrl({
    recipientPhone: phone,
    recipientName: voucher.recipient_name,
    senderName: voucher.sender_name,
    senderMessage: voucher.sender_message ?? undefined,
    voucherCode: voucher.code,
    serviceName: voucher.services?.name ?? "Kalanara Spa",
    serviceDuration: voucher.services?.duration ?? 0,
    amount: voucher.amount,
    expiryDate: voucher.expiry_date,
    verifyUrl: `${appUrl}/verify?code=${encodeURIComponent(voucher.code)}`,
  });

  logAdminAudit(access, {
    action: "orders.voucher_whatsapp_link",
    target: voucher.id,
    details: { orderId: order.id, targetKind: target.data },
  });

  return { status: "ok", url };
}
