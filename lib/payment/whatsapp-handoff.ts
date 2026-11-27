import "server-only";

import { getAdminClient } from "@/lib/supabase/admin";
import type { PublicOrderStatusPayload } from "@/lib/scalev/types";

const WA_ME_PREFIX = "https://wa.me/";

export type PublicEmailStatus = "SENT" | "PENDING" | "FAILED";

export function isSafeWhatsAppHandoffUrl(value: unknown): value is string {
  if (typeof value !== "string" || !value.startsWith(WA_ME_PREFIX)) {
    return false;
  }
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.hostname === "wa.me" && /^\/\d{8,15}$/.test(url.pathname);
  } catch {
    return false;
  }
}

function publicEmailStatus(status: string | null | undefined): PublicEmailStatus {
  if (status === "SENT") return "SENT";
  if (status === "FAILED") return "FAILED";
  return "PENDING";
}

interface VoucherDeliveryState {
  emailStatus?: PublicEmailStatus;
  whatsappLink?: string;
}

type OutboxRow = {
  channel: string;
  status: string | null;
  handoff_url: string | null;
  vouchers: { code: string } | { code: string }[] | null;
};

/**
 * Reads the order's delivery outbox, keyed by voucher code: whether the
 * voucher email went out, and the wa.me link deliverVoucher saved. The status
 * session already proves the caller owns the order, and the link only carries
 * what the success page already shows.
 */
export async function loadVoucherDeliveryState(
  orderId: string
): Promise<Map<string, VoucherDeliveryState>> {
  const { data, error } = await getAdminClient()
    .from("voucher_delivery_outbox")
    .select("channel, status, handoff_url, vouchers!voucher_delivery_outbox_voucher_id_fkey(code)")
    .eq("order_id", orderId)
    .in("channel", ["EMAIL", "WHATSAPP"]);

  if (error || !data) {
    // No order or session details in the log.
    console.error("Voucher delivery state read failed.");
    return new Map();
  }

  const states = new Map<string, VoucherDeliveryState>();
  for (const row of data as OutboxRow[]) {
    const voucher = Array.isArray(row.vouchers) ? row.vouchers[0] : row.vouchers;
    if (!voucher?.code) continue;
    const state = states.get(voucher.code) ?? {};
    if (row.channel === "EMAIL") {
      state.emailStatus = publicEmailStatus(row.status);
    } else if (row.channel === "WHATSAPP" && isSafeWhatsAppHandoffUrl(row.handoff_url)) {
      state.whatsappLink = row.handoff_url;
    }
    states.set(voucher.code, state);
  }
  return states;
}

export async function withVoucherDeliveryState(
  orderId: string,
  payload: PublicOrderStatusPayload
): Promise<PublicOrderStatusPayload> {
  if (payload.status !== "completed" || !(payload.vouchers?.length || payload.voucher)) {
    return payload;
  }

  const states = await loadVoucherDeliveryState(orderId).catch(() => {
    console.error("Voucher delivery state read failed.");
    return new Map<string, VoucherDeliveryState>();
  });
  if (states.size === 0) {
    return payload;
  }

  const attach = <T extends { voucherCode: string }>(voucher: T) => {
    const state = states.get(voucher.voucherCode);
    return state ? { ...voucher, ...state } : voucher;
  };

  return {
    ...payload,
    voucher: payload.voucher ? attach(payload.voucher) : payload.voucher,
    vouchers: payload.vouchers?.map(attach),
  };
}
