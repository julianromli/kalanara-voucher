import { describe, expect, test } from "vitest";
import { voucherFaceValue } from "@/lib/payment/voucher-face-value";

describe("voucherFaceValue", () => {
  test("keeps the service price when a code removes the full line price", () => {
    expect(
      voucherFaceValue({ original_unit_price: 280000, unit_price: 0 })
    ).toBe(280000);
  });

  test("keeps the paid price for a partial discount", () => {
    expect(
      voucherFaceValue({ original_unit_price: 280000, unit_price: 200000 })
    ).toBe(200000);
  });
});
