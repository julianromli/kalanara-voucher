import { afterEach, describe, expect, test, vi } from "vitest";
import { APP_CONFIG } from "@/lib/constants";
import {
  DEFAULT_VOUCHER_VALIDITY_MONTHS,
  calculateExpiryDate,
} from "@/lib/payment/voucher-expiry";

describe("calculateExpiryDate", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  test("locks the default validity to 3 calendar months, not 1 year", () => {
    expect(DEFAULT_VOUCHER_VALIDITY_MONTHS).toBe(3);
    expect(APP_CONFIG.voucherValidityMonths).toBe(3);

    const from = new Date("2026-06-15T08:00:00.000Z");
    const expiry = new Date(calculateExpiryDate(from));

    expect(expiry.toISOString()).toBe("2026-09-15T08:00:00.000Z");
    expect(expiry.getUTCFullYear()).toBe(from.getUTCFullYear());
  });

  test("adds calendar months across a year boundary", () => {
    expect(calculateExpiryDate(new Date("2026-11-22T10:00:00.000Z"))).toBe(
      "2027-02-22T10:00:00.000Z"
    );
  });

  test("follows Date.setMonth overflow for month-end dates", () => {
    expect(calculateExpiryDate(new Date("2026-01-31T00:00:00.000Z"))).toBe(
      "2026-05-01T00:00:00.000Z"
    );
  });

  test("is not a fixed 90-day count", () => {
    const from = new Date("2026-10-31T00:00:00.000Z");
    const expiry = calculateExpiryDate(from);
    const ninetyDaysLater = new Date(from);
    ninetyDaysLater.setUTCDate(ninetyDaysLater.getUTCDate() + 90);

    expect(expiry).toBe("2027-01-31T00:00:00.000Z");
    expect(expiry).not.toBe(ninetyDaysLater.toISOString());
    expect(ninetyDaysLater.toISOString()).toBe("2027-01-29T00:00:00.000Z");
  });

  test("uses the current time when no start date is provided", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-10T12:00:00.000Z"));

    expect(calculateExpiryDate()).toBe("2026-06-10T12:00:00.000Z");
  });
});
