import { describe, expect, test } from "vitest";
import {
  allocateDiscountAcrossItems,
  calculateDiscountAmount,
  normalizeCustomerPhone,
} from "@/lib/discounts/service";

describe("discount math", () => {
  test("calculates fixed discounts and clamps at zero", () => {
    expect(calculateDiscountAmount(450000, "FIXED_AMOUNT", 50000)).toBe(50000);
    expect(calculateDiscountAmount(450000, "FIXED_AMOUNT", 999999)).toBe(450000);
  });

  test("calculates percentage discounts with rounding", () => {
    expect(calculateDiscountAmount(333333, "PERCENTAGE", 10)).toBe(33333);
    expect(calculateDiscountAmount(335, "PERCENTAGE", 10)).toBe(34);
  });

  test("allocates order-level discounts proportionally and keeps the remainder on the last item", () => {
    expect(allocateDiscountAcrossItems([100000, 100000, 100001], 10000)).toEqual([
      3333,
      3333,
      3334,
    ]);
  });

  test("normalizes Indonesian customer phone numbers consistently", () => {
    expect(normalizeCustomerPhone("0812-3456-7890")).toBe("6281234567890");
    expect(normalizeCustomerPhone("6281234567890")).toBe("6281234567890");
    expect(normalizeCustomerPhone("81234567890")).toBe("6281234567890");
  });
});
