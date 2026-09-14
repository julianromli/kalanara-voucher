import "server-only";

import { getAdminClient } from "@/lib/supabase/admin";
import type {
  VoucherDeliveryChannel,
  VoucherDeliveryOutboxUpdate,
} from "@/lib/database.types";

export type { VoucherDeliveryChannel };

export interface ClaimedVoucherDelivery {
  id: string;
  channel: VoucherDeliveryChannel;
}

interface ClaimVoucherDeliveriesInput {
  orderId: string;
  orderItemId: string | null;
  voucherId: string;
  channels: VoucherDeliveryChannel[];
}

const MAX_ERROR_LENGTH = 1_000;
const MAX_RETRY_MINUTES = 60;

function persistenceError(action: string, error?: { message?: string } | null) {
  return new Error(
    `Failed to persist voucher delivery ${action}${
      error?.message ? `: ${error.message}` : ""
    }`
  );
}

function isClaimedDelivery(value: unknown): value is ClaimedVoucherDelivery {
  if (!value || typeof value !== "object") {
    return false;
  }

  const row = value as Record<string, unknown>;
  return (
    typeof row.id === "string" &&
    (row.channel === "EMAIL" || row.channel === "WHATSAPP")
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

  return data;
}

export async function markVoucherDeliverySent(
  deliveryId: string
): Promise<void> {
  const now = new Date().toISOString();
  const update: VoucherDeliveryOutboxUpdate = {
    status: "SENT",
    sent_at: now,
    updated_at: now,
    claimed_at: null,
    last_error: null,
  };
  const supabase = getAdminClient();
  const { data, error } = await supabase
    .from("voucher_delivery_outbox")
    .update(update)
    .eq("id", deliveryId)
    .eq("status", "PROCESSING")
    .select("id")
    .maybeSingle();

  if (error || !data) {
    throw persistenceError("SENT", error);
  }
}

export async function markVoucherDeliveryFailed(
  deliveryId: string,
  error: unknown
): Promise<void> {
  const supabase = getAdminClient();
  const { data: claimed, error: readError } = await supabase
    .from("voucher_delivery_outbox")
    .select("attempt_count")
    .eq("id", deliveryId)
    .eq("status", "PROCESSING")
    .single();

  if (readError || !claimed) {
    throw persistenceError("FAILED retry read", readError);
  }

  const retryMinutes = Math.min(
    2 ** Math.max(claimed.attempt_count - 1, 0),
    MAX_RETRY_MINUTES
  );
  const now = new Date();
  const update: VoucherDeliveryOutboxUpdate = {
    status: "FAILED",
    claimed_at: null,
    last_error: boundedError(error),
    next_attempt_at: new Date(
      now.getTime() + retryMinutes * 60_000
    ).toISOString(),
    updated_at: now.toISOString(),
  };
  const { data, error: updateError } = await supabase
    .from("voucher_delivery_outbox")
    .update(update)
    .eq("id", deliveryId)
    .eq("status", "PROCESSING")
    .select("id")
    .maybeSingle();

  if (updateError || !data) {
    throw persistenceError("FAILED", updateError);
  }
}
