import "server-only";

import { getAdminClient } from "@/lib/supabase/admin";
import type { PublicOrderStatusPayload } from "@/lib/scalev/types";

const WA_ME_PREFIX = "https://wa.me/";

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

/**
 * Reads the wa.me links saved by deliverVoucher for one order, keyed by
 * voucher code. The status session already proves the caller owns the order,
 * and the link only carries what the success page already shows.
 */
export async function loadWhatsAppHandoffLinks(orderId: string): Promise<Map<string, string>> {
  const { data, error } = await getAdminClient()
    .from("voucher_delivery_outbox")
    .select("handoff_url, vouchers!voucher_delivery_outbox_voucher_id_fkey(code)")
    .eq("order_id", orderId)
    .eq("channel", "WHATSAPP")
    .not("handoff_url", "is", null);

  if (error || !data) {
    return new Map();
  }

  const links = new Map<string, string>();
  for (const row of data as Array<{ handoff_url: string | null; vouchers: { code: string } | { code: string }[] | null }>) {
    const voucher = Array.isArray(row.vouchers) ? row.vouchers[0] : row.vouchers;
    if (voucher?.code && isSafeWhatsAppHandoffUrl(row.handoff_url)) {
      links.set(voucher.code, row.handoff_url);
    }
  }
  return links;
}

export async function withWhatsAppHandoffLinks(
  orderId: string,
  payload: PublicOrderStatusPayload
): Promise<PublicOrderStatusPayload> {
  const needsLink = (payload.vouchers ?? []).some(
    (voucher) => voucher.deliveryMethod === "WHATSAPP" || voucher.deliveryMethod === "BOTH"
  );
  if (payload.status !== "completed" || !needsLink) {
    return payload;
  }

  const links = await loadWhatsAppHandoffLinks(orderId).catch(() => new Map<string, string>());
  if (links.size === 0) {
    return payload;
  }

  const attach = <T extends { voucherCode: string }>(voucher: T) => {
    const whatsappLink = links.get(voucher.voucherCode);
    return whatsappLink ? { ...voucher, whatsappLink } : voucher;
  };

  return {
    ...payload,
    voucher: payload.voucher ? attach(payload.voucher) : payload.voucher,
    vouchers: payload.vouchers?.map(attach),
  };
}
