export type VoucherDeliveryStatus =
  | "PENDING"
  | "PROCESSING"
  | "SENT"
  | "FAILED"
  | "HANDOFF_REQUIRED";

export interface VoucherDeliveryClaimState {
  status: VoucherDeliveryStatus;
  nextAttemptAt: number;
  claimedAt: number | null;
}

export const VOUCHER_DELIVERY_CLAIM_TIMEOUT_MS = 5 * 60_000;
export const VOUCHER_DELIVERY_MAX_HANDOFF_URL_LENGTH = 8192;

export function isVoucherDeliveryClaimable(
  delivery: VoucherDeliveryClaimState,
  now: number,
) {
  return (
    delivery.status === "PENDING" ||
    (delivery.status === "FAILED" && delivery.nextAttemptAt <= now) ||
    (delivery.status === "PROCESSING" &&
      delivery.claimedAt !== null &&
      delivery.claimedAt < now - VOUCHER_DELIVERY_CLAIM_TIMEOUT_MS)
  );
}

export function getVoucherDeliveryRetryDelayMinutes(attemptCount: number) {
  const exponent = Math.min(Math.max(attemptCount - 1, 0), 6);
  return Math.min(2 ** exponent, 60);
}

export function canFinalizeVoucherDelivery(
  status: VoucherDeliveryStatus,
  activeClaimToken: string | null,
  presentedClaimToken: string,
) {
  return (
    status === "PROCESSING" &&
    activeClaimToken !== null &&
    activeClaimToken === presentedClaimToken
  );
}

export function isValidVoucherDeliveryHandoffUrl(value: string | null) {
  return (
    value !== null &&
    value.length > 0 &&
    value === value.trim() &&
    value.length <= VOUCHER_DELIVERY_MAX_HANDOFF_URL_LENGTH
  );
}
