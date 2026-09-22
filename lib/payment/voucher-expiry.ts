export const VOUCHER_DEFAULT_EXPIRATION_DAYS_KEY =
  "voucher_default_expiration_days" as const;

export const DEFAULT_VOUCHER_EXPIRATION_DAYS = 90;
export const VOUCHER_EXPIRATION_DAYS_MIN = 1;
export const VOUCHER_EXPIRATION_DAYS_MAX = 365;

/** Public marketing approximation of the 90-day fallback. */
export const DEFAULT_VOUCHER_VALIDITY_MONTHS = 3;

export function parseVoucherExpirationDays(
  value?: string | number | null
): number {
  if (typeof value === "number") {
    return Number.isInteger(value) &&
      value >= VOUCHER_EXPIRATION_DAYS_MIN &&
      value <= VOUCHER_EXPIRATION_DAYS_MAX
      ? value
      : DEFAULT_VOUCHER_EXPIRATION_DAYS;
  }

  if (typeof value !== "string") {
    return DEFAULT_VOUCHER_EXPIRATION_DAYS;
  }

  const trimmed = value.trim();
  if (!/^\d+$/.test(trimmed)) {
    return DEFAULT_VOUCHER_EXPIRATION_DAYS;
  }

  const days = Number.parseInt(trimmed, 10);
  if (
    days < VOUCHER_EXPIRATION_DAYS_MIN ||
    days > VOUCHER_EXPIRATION_DAYS_MAX
  ) {
    return DEFAULT_VOUCHER_EXPIRATION_DAYS;
  }

  return days;
}

export function normalizeVoucherExpirationDaysInput(
  value: string | number
): number {
  if (typeof value === "number") {
    if (
      Number.isInteger(value) &&
      value >= VOUCHER_EXPIRATION_DAYS_MIN &&
      value <= VOUCHER_EXPIRATION_DAYS_MAX
    ) {
      return value;
    }

    throw new Error(
      `Default expiration must be a whole number between ${VOUCHER_EXPIRATION_DAYS_MIN} and ${VOUCHER_EXPIRATION_DAYS_MAX} days.`
    );
  }

  const trimmed = value.trim();
  if (!/^\d+$/.test(trimmed)) {
    throw new Error(
      `Default expiration must be a whole number between ${VOUCHER_EXPIRATION_DAYS_MIN} and ${VOUCHER_EXPIRATION_DAYS_MAX} days.`
    );
  }

  return normalizeVoucherExpirationDaysInput(Number.parseInt(trimmed, 10));
}

export function calculateExpiryDate(
  from: Date = new Date(),
  days: number = DEFAULT_VOUCHER_EXPIRATION_DAYS
): string {
  const expiryDate = new Date(from.getTime());
  expiryDate.setDate(expiryDate.getDate() + days);
  return expiryDate.toISOString();
}
