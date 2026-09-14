import "server-only";

export function resolveScalevProviderEventAt(
  providerEventAt: string | null | undefined,
  receiptTime: string,
  source: "webhook" | "reconciliation" | "checkout"
): { timestamp: string; isFallback: boolean } {
  if (
    typeof providerEventAt === "string" &&
    providerEventAt.trim() &&
    Number.isFinite(Date.parse(providerEventAt))
  ) {
    return { timestamp: providerEventAt, isFallback: false };
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
