import "server-only";

import { revalidateTag } from "next/cache";
import type { PaymentStatus } from "@/lib/database.types";
import { getAdminClient } from "@/lib/supabase/admin";

export interface GatewayPaymentUpdate {
  transactionId?: string | null;
  paymentType?: string | null;
  transactionTime?: string | null;
  transaction_id?: string | null;
  payment_type?: string | null;
  transaction_time?: string | null;
  paymentProvider?: string;
  paymentLink?: string | null;
  scalevOrderPk?: number | null;
  scalevOrderId?: string | null;
  scalevPgReferenceId?: string | null;
  scalevPaymentMethod?: string | null;
  scalevSubPaymentMethod?: string | null;
  scalevStoreUniqueId?: string | null;
  scalevLastCheckedAt?: string | null;
  scalevRawStatus?: string | null;
  scalevRawPaymentStatus?: string | null;
}

export type PaymentTransitionRejectionReason =
  | "not_found"
  | "missing_provider_event_at"
  | "version_conflict"
  | "stale_provider_event"
  | "transition_rejected"
  | "database_error";

export type PaymentTransitionResult =
  | {
      accepted: true;
      changed: boolean;
      reason: "applied" | "idempotent";
      previousStatus: PaymentStatus;
      currentStatus: PaymentStatus;
      stateVersion: number;
    }
  | {
      accepted: false;
      changed: false;
      reason: PaymentTransitionRejectionReason;
      currentStatus?: PaymentStatus;
      stateVersion?: number;
    };

export interface TransitionOrderPaymentStateInput {
  orderId: string;
  targetStatus: PaymentStatus;
  provider: string;
  providerEventAt: string | null;
  expectedVersion?: number | null;
  gatewayUpdate?: GatewayPaymentUpdate;
}

const PAYMENT_STATUSES = new Set<PaymentStatus>([
  "PENDING",
  "COMPLETED",
  "FAILED",
  "REFUNDED",
]);
const REJECTION_REASONS = new Set<PaymentTransitionRejectionReason>([
  "not_found",
  "missing_provider_event_at",
  "version_conflict",
  "stale_provider_event",
  "transition_rejected",
]);

function isPaymentStatus(value: unknown): value is PaymentStatus {
  return typeof value === "string" && PAYMENT_STATUSES.has(value as PaymentStatus);
}

function databaseError(): PaymentTransitionResult {
  return {
    accepted: false,
    changed: false,
    reason: "database_error",
  };
}

export async function transitionOrderPaymentState(
  input: TransitionOrderPaymentStateInput
): Promise<PaymentTransitionResult> {
  const update = input.gatewayUpdate;

  try {
    const { data, error } = await getAdminClient().rpc(
      "transition_order_payment_state",
      {
        p_order_id: input.orderId,
        p_target_status: input.targetStatus,
        p_provider: input.provider,
        p_provider_event_at: input.providerEventAt as string,
        p_expected_version: input.expectedVersion ?? null,
        p_transaction_id:
          update?.transactionId ?? update?.transaction_id ?? null,
        p_payment_type: update?.paymentType ?? update?.payment_type ?? null,
        p_transaction_time:
          update?.transactionTime ?? update?.transaction_time ?? null,
        p_payment_link: update?.paymentLink ?? null,
        p_scalev_order_pk: update?.scalevOrderPk ?? null,
        p_scalev_order_id: update?.scalevOrderId ?? null,
        p_scalev_pg_reference_id: update?.scalevPgReferenceId ?? null,
        p_scalev_payment_method: update?.scalevPaymentMethod ?? null,
        p_scalev_sub_payment_method: update?.scalevSubPaymentMethod ?? null,
        p_scalev_store_unique_id: update?.scalevStoreUniqueId ?? null,
        p_scalev_raw_status: update?.scalevRawStatus ?? null,
        p_scalev_raw_payment_status: update?.scalevRawPaymentStatus ?? null,
        p_scalev_last_checked_at: update?.scalevLastCheckedAt ?? null,
      }
    );

    if (error || !Array.isArray(data) || data.length !== 1) {
      console.error("[Payment State] Transition RPC failed or returned no row.");
      return databaseError();
    }

    const row = data[0];
    if (
      typeof row !== "object" ||
      row === null ||
      typeof row.accepted !== "boolean" ||
      typeof row.changed !== "boolean" ||
      typeof row.reason !== "string"
    ) {
      console.error("[Payment State] Transition RPC returned a malformed row.");
      return databaseError();
    }

    if (row.accepted) {
      if (
        !["applied", "idempotent"].includes(row.reason) ||
        !isPaymentStatus(row.previous_status) ||
        !isPaymentStatus(row.current_status) ||
        row.current_status !== input.targetStatus ||
        typeof row.state_version !== "number" ||
        !Number.isSafeInteger(row.state_version) ||
        row.state_version < 0 ||
        row.changed !== (row.reason === "applied")
      ) {
        console.error("[Payment State] Accepted transition row was malformed.");
        return databaseError();
      }

      revalidateTag("dashboard-stats", "max");
      return {
        accepted: true,
        changed: row.changed,
        reason: row.reason as "applied" | "idempotent",
        previousStatus: row.previous_status,
        currentStatus: row.current_status,
        stateVersion: row.state_version,
      };
    }

    if (
      row.changed ||
      !REJECTION_REASONS.has(row.reason as PaymentTransitionRejectionReason)
    ) {
      console.error("[Payment State] Rejected transition row was malformed.");
      return databaseError();
    }

    return {
      accepted: false,
      changed: false,
      reason: row.reason as PaymentTransitionRejectionReason,
      ...(isPaymentStatus(row.current_status)
        ? { currentStatus: row.current_status }
        : {}),
      ...(typeof row.state_version === "number" &&
      Number.isSafeInteger(row.state_version) &&
      row.state_version >= 0
        ? { stateVersion: row.state_version }
        : {}),
    };
  } catch {
    console.error("[Payment State] Transition RPC threw an unexpected error.");
    return databaseError();
  }
}
