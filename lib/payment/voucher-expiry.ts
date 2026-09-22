export const DEFAULT_VOUCHER_VALIDITY_MONTHS = 3;

export function calculateExpiryDate(from: Date = new Date()): string {
  const expiryDate = new Date(from.getTime());
  expiryDate.setMonth(
    expiryDate.getMonth() + DEFAULT_VOUCHER_VALIDITY_MONTHS
  );
  return expiryDate.toISOString();
}
