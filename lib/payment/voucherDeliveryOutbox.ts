import "server-only";

import { getAdminClient } from "@/lib/supabase/admin";
import type { VoucherDeliveryChannel } from "@/lib/database.types";

export type { VoucherDeliveryChannel };

export interface ClaimedVoucherDelivery {
  id: string;
  channel: VoucherDeliveryChannel;
  claimToken: string;
}

interface ClaimedVoucherDeliveryRow {
  id: string;
  channel: VoucherDeliveryChannel;
  claim_token: string;
}

interface ClaimVoucherDeliveriesInput {
  orderId: string;
  orderItemId: string | null;
  voucherId: string;
  channels: VoucherDeliveryChannel[];
}

const MAX_ERROR_LENGTH = 1_000;

function persistenceError(action: string, error?: { message?: string } | null) {
  return new Error(
    `Failed to persist voucher delivery ${action}${
      error?.message ? `: ${error.message}` : ""
    }`
  );
}

function isClaimedDelivery(value: unknown): value is ClaimedVoucherDeliveryRow {
  if (!value || typeof value !== "object") {
    return false;
  }

  const row = value as Record<string, unknown>;
  return (
    typeof row.id === "string" &&
    (row.channel === "EMAIL" || row.channel === "WHATSAPP") &&
    typeof row.claim_token === "string"
  );
}

function boundedError(error: unknown): string {
  let message: string;
  if (error instanceof Error) {
    message = `${error.name}: ${error.message}`;
  } else if (typeof error === "string") {
    message = error;
  } else {
    try {
      message = JSON.stringify(error);
    } catch {
      message = String(error);
    }
  }

  return (message || "Unknown voucher delivery error").slice(
    0,
    MAX_ERROR_LENGTH
  );
}

export async function claimVoucherDeliveries(
  input: ClaimVoucherDeliveriesInput
): Promise<ClaimedVoucherDelivery[]> {
  if (input.channels.length === 0) {
    return [];
  }

  const supabase = getAdminClient();
  const { data, error } = await supabase.rpc("claim_voucher_deliveries", {
    p_order_id: input.orderId,
    p_order_item_id: input.orderItemId,
    p_voucher_id: input.voucherId,
    p_channels: input.channels,
  });

  if (error) {
    throw persistenceError("claim", error);
  }
  if (!Array.isArray(data) || !data.every(isClaimedDelivery)) {
    throw new Error("Invalid voucher delivery claim response");
  }

  return data.map((row) => ({
    id: row.id,
    channel: row.channel,
    claimToken: row.claim_token,
  }));
}

export async function markVoucherDeliverySent(
  deliveryId: string,
  claimToken: string
): Promise<void> {
  const { data, error } = await getAdminClient().rpc(
    "finalize_voucher_delivery_sent",
    { p_delivery_id: deliveryId, p_claim_token: claimToken }
  );

  if (error || data !== true) {
    throw persistenceError("SENT", error);
  }
}

export async function markVoucherDeliveryHandoffRequired(
  deliveryId: string,
  claimToken: string
): Promise<void> {
  const { data, error } = await getAdminClient().rpc(
    "finalize_voucher_delivery_handoff_required",
    { p_delivery_id: deliveryId, p_claim_token: claimToken }
  );

  if (error || data !== true) {
    throw persistenceError("HANDOFF_REQUIRED", error);
  }
}

export async function markVoucherDeliveryFailed(
  deliveryId: string,
  claimToken: string,
  error: unknown
): Promise<void> {
  const { data, error: updateError } = await getAdminClient().rpc(
    "finalize_voucher_delivery_failed",
    {
      p_delivery_id: deliveryId,
      p_claim_token: claimToken,
      p_error: boundedError(error),
    }
  );

  if (updateError || data !== true) {
    throw persistenceError("FAILED", updateError);
  }
}
