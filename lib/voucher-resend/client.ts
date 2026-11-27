import type { ResendFailureStatus, ResendTarget } from "@/lib/voucher-resend/shared";

export type ResendVoucherEmailResponse =
  | { status: "sent"; to: string; recipientEmailUpdated: boolean }
  | { status: "sent_not_logged"; to: string }
  | { status: ResendFailureStatus | "forbidden"; retryAfterSeconds?: number | null };

// Throws only when the request itself fails (offline, DNS, CORS), so the
// dialog can say "Koneksi putus" for that case alone.
export async function requestVoucherResend(input: {
  orderId: string;
  voucherId: string;
  target: ResendTarget;
  email?: string;
  saveAsRecipient?: boolean;
}): Promise<ResendVoucherEmailResponse> {
  const response = await fetch("/api/admin/vouchers/resend", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify(input),
  });
  const payload: unknown = await response.json().catch(() => null);
  const status =
    payload && typeof payload === "object" && typeof (payload as { status?: unknown }).status === "string"
      ? (payload as { status: string }).status
      : null;
  if (!status) return { status: "error" };
  return payload as ResendVoucherEmailResponse;
}
