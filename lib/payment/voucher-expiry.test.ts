import { afterEach, describe, expect, test, vi } from "vitest";
import { APP_CONFIG } from "@/lib/constants";
import {
  DEFAULT_VOUCHER_EXPIRATION_DAYS,
  DEFAULT_VOUCHER_VALIDITY_MONTHS,
  VOUCHER_DEFAULT_EXPIRATION_DAYS_KEY,
  calculateExpiryDate,
  normalizeVoucherExpirationDaysInput,
  parseVoucherExpirationDays,
} from "@/lib/payment/voucher-expiry";

describe("voucher expiration days", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  test("falls back to 90 days for missing or invalid settings", () => {
    expect(VOUCHER_DEFAULT_EXPIRATION_DAYS_KEY).toBe(
      "voucher_default_expiration_days"
    );
    expect(DEFAULT_VOUCHER_EXPIRATION_DAYS).toBe(90);
    expect(DEFAULT_VOUCHER_VALIDITY_MONTHS).toBe(3);
    expect(APP_CONFIG.voucherValidityMonths).toBe(3);

    expect(parseVoucherExpirationDays(undefined)).toBe(90);
    expect(parseVoucherExpirationDays(null)).toBe(90);
    expect(parseVoucherExpirationDays("")).toBe(90);
    expect(parseVoucherExpirationDays("  ")).toBe(90);
    expect(parseVoucherExpirationDays("abc")).toBe(90);
    expect(parseVoucherExpirationDays("90.5")).toBe(90);
    expect(parseVoucherExpirationDays("0")).toBe(90);
    expect(parseVoucherExpirationDays("-1")).toBe(90);
    expect(parseVoucherExpirationDays("366")).toBe(90);
    expect(parseVoucherExpirationDays(Number.NaN)).toBe(90);
  });

  test("accepts whole days in the 1-365 range", () => {
    expect(parseVoucherExpirationDays("1")).toBe(1);
    expect(parseVoucherExpirationDays(" 30 ")).toBe(30);
    expect(parseVoucherExpirationDays(90)).toBe(90);
    expect(parseVoucherExpirationDays("365")).toBe(365);
    expect(normalizeVoucherExpirationDaysInput(" 120 ")).toBe(120);
    expect(normalizeVoucherExpirationDaysInput(7)).toBe(7);
  });

  test("rejects invalid admin input instead of silently defaulting", () => {
    expect(() => normalizeVoucherExpirationDaysInput("")).toThrow(
      /whole number between 1 and 365/i
    );
    expect(() => normalizeVoucherExpirationDaysInput("0")).toThrow(
      /whole number between 1 and 365/i
    );
    expect(() => normalizeVoucherExpirationDaysInput("366")).toThrow(
      /whole number between 1 and 365/i
    );
    expect(() => normalizeVoucherExpirationDaysInput("90days")).toThrow(
      /whole number between 1 and 365/i
    );
    expect(() => normalizeVoucherExpirationDaysInput(Number.NaN)).toThrow(
      /whole number between 1 and 365/i
    );
  });

  test("adds the configured day count from the creation time", () => {
    const from = new Date("2026-06-15T08:00:00.000Z");

    expect(calculateExpiryDate(from, 90)).toBe("2026-09-13T08:00:00.000Z");
    expect(calculateExpiryDate(from, 30)).toBe("2026-07-15T08:00:00.000Z");
  });

  test("defaults calculateExpiryDate to 90 days", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-10T12:00:00.000Z"));

    expect(calculateExpiryDate()).toBe("2026-06-08T12:00:00.000Z");
  });
});
