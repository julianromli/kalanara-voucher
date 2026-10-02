import { describe, expect, test } from "vitest";
import {
  preferredPaymentMethod,
  sortPaymentOptions,
} from "@/lib/scalev/payment-order";
import type { ScalevPaymentOption } from "@/lib/scalev/types";

const options: ScalevPaymentOption[] = [
  { code: "dana", label: "DANA" },
  { code: "ovo", label: "OVO" },
  { code: "qris", label: "QRIS" },
  { code: "shopeepay", label: "ShopeePay" },
];

describe("payment option order", () => {
  test("puts QRIS ahead of e-wallets", () => {
    expect(sortPaymentOptions(options).map((option) => option.code)).toEqual([
      "qris",
      "dana",
      "ovo",
      "shopeepay",
    ]);
    expect(preferredPaymentMethod(options)).toBe("qris");
  });

  test("uses the first remaining method when QRIS is absent", () => {
    const withoutQris = options.filter((option) => option.code !== "qris");
    expect(preferredPaymentMethod(withoutQris)).toBe("dana");
  });
});