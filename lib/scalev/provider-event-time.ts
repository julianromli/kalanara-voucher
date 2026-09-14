import "server-only";

export const SCALEV_PROVIDER_EVENT_MAX_CLOCK_SKEW_MS = 5 * 60 * 1_000;

export function resolveScalevProviderEventAt(
  providerEventAt: string | null | undefined,
  receiptTime: string,
  source: "webhook" | "reconciliation" | "checkout"
): { timestamp: string; isFallback: boolean } {
  const providerEventTime =
    typeof providerEventAt === "string" && providerEventAt.trim()
      ? Date.parse(providerEventAt)
      : Number.NaN;
  const receiptTimestamp = Date.parse(receiptTime);

  if (
    Number.isFinite(providerEventTime) &&
    Number.isFinite(receiptTimestamp) &&
    providerEventTime <=
      receiptTimestamp + SCALEV_PROVIDER_EVENT_MAX_CLOCK_SKEW_MS
  ) {
    return { timestamp: providerEventAt as string, isFallback: false };
  }

  // Scalev does not consistently include event timestamps. This log documents
  // the receipt-time fallback without payloads, customer data, or identifiers.
  if (process.env.NODE_ENV !== "production") {
    console.warn(
      `[Scalev] ${source} provider event timestamp unavailable; using receipt time.`
    );
  }
  return { timestamp: receiptTime, isFallback: true };
}
