import { describe, expect, test } from "vitest";
import {
  canFinalizeVoucherDelivery,
  getVoucherDeliveryRetryDelayMinutes,
  isValidVoucherDeliveryHandoffUrl,
  isVoucherDeliveryClaimable,
  VOUCHER_DELIVERY_CLAIM_TIMEOUT_MS,
  VOUCHER_DELIVERY_MAX_HANDOFF_URL_LENGTH,
} from "@/lib/payment/voucher-delivery-contract";

// These executable TypeScript tests document intended delivery rules.
// They do not execute or prove the PostgreSQL migration.
describe("executable voucher delivery rule contract (not SQL execution)", () => {
  test("claims pending, due failed, and stale processing deliveries only", () => {
    const now = Date.parse("2026-09-14T12:00:00.000Z");

    expect(
      isVoucherDeliveryClaimable(
        { status: "PENDING", nextAttemptAt: now + 1, claimedAt: null },
        now,
      ),
    ).toBe(true);
    expect(
      isVoucherDeliveryClaimable(
        { status: "FAILED", nextAttemptAt: now, claimedAt: null },
        now,
      ),
    ).toBe(true);
    expect(
      isVoucherDeliveryClaimable(
        { status: "FAILED", nextAttemptAt: now + 1, claimedAt: null },
        now,
      ),
    ).toBe(false);
    expect(
      isVoucherDeliveryClaimable(
        {
          status: "PROCESSING",
          nextAttemptAt: now,
          claimedAt: now - VOUCHER_DELIVERY_CLAIM_TIMEOUT_MS - 1,
        },
        now,
      ),
    ).toBe(true);
    expect(
      isVoucherDeliveryClaimable(
        {
          status: "PROCESSING",
          nextAttemptAt: now,
          claimedAt: now - VOUCHER_DELIVERY_CLAIM_TIMEOUT_MS,
        },
        now,
      ),
    ).toBe(false);

    for (const status of ["SENT", "HANDOFF_REQUIRED"] as const) {
      expect(
        isVoucherDeliveryClaimable(
          { status, nextAttemptAt: now, claimedAt: null },
          now,
        ),
      ).toBe(false);
    }
  });

  test("uses capped exponential retry delays", () => {
    expect(
      [0, 1, 2, 3, 4, 5, 6, 7, 20].map(
        getVoucherDeliveryRetryDelayMinutes,
      ),
    ).toEqual([1, 1, 2, 4, 8, 16, 32, 60, 60]);
  });

  test("finalizes only processing deliveries with the current claim token", () => {
    expect(canFinalizeVoucherDelivery("PROCESSING", "current", "current")).toBe(
      true,
    );
    expect(canFinalizeVoucherDelivery("PROCESSING", "current", "stale")).toBe(
      false,
    );
    expect(canFinalizeVoucherDelivery("PROCESSING", null, "current")).toBe(
      false,
    );
    expect(canFinalizeVoucherDelivery("FAILED", "current", "current")).toBe(
      false,
    );
  });

  test("accepts only bounded, nonblank, already-trimmed handoff URLs", () => {
    expect(isValidVoucherDeliveryHandoffUrl("https://wa.me/628123")).toBe(true);
    expect(isValidVoucherDeliveryHandoffUrl(null)).toBe(false);
    expect(isValidVoucherDeliveryHandoffUrl("")).toBe(false);
    expect(isValidVoucherDeliveryHandoffUrl(" https://wa.me/628123")).toBe(
      false,
    );
    expect(
      isValidVoucherDeliveryHandoffUrl(
        "x".repeat(VOUCHER_DELIVERY_MAX_HANDOFF_URL_LENGTH + 1),
      ),
    ).toBe(false);
  });
});
