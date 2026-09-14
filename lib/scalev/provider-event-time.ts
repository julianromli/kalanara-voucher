import "server-only";

export function resolveScalevProviderEventAt(
  providerEventAt: string | null | undefined,
  receiptTime: string,
  source: "webhook" | "reconciliation" | "checkout"
): string {
  if (
    typeof providerEventAt === "string" &&
    providerEventAt.trim() &&
    Number.isFinite(Date.parse(providerEventAt))
  ) {
    return providerEventAt;
  }

  // Scalev does not consistently include event timestamps. This log documents
  // the receipt-time fallback without payloads, customer data, or identifiers.
  console.warn(
    `[Scalev] ${source} provider event timestamp unavailable; using receipt time.`
  );
  return receiptTime;
}
