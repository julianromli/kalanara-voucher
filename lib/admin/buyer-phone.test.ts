import { describe, expect, test } from "vitest";
import {
  buyerPath,
  formatBuyerPhone,
  normalizeBuyerPhone,
} from "@/lib/admin/buyer-phone";

describe("buyer phone", () => {
  test("normalizes local and international numbers the same way", () => {
    expect(normalizeBuyerPhone("0812-3456-7890")).toBe("6281234567890");
    expect(normalizeBuyerPhone("+62 812 3456 7890")).toBe("6281234567890");
    expect(normalizeBuyerPhone("81234567890")).toBe("6281234567890");
  });

  test("formats a buyer path from any accepted phone", () => {
    expect(formatBuyerPhone("081234567890")).toBe("+62 812 3456 7890");
    expect(buyerPath("081234567890")).toBe("/admin/buyers/6281234567890");
  });
});
