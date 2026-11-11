import { describe, expect, test } from "vitest";
import { groupScalevOrderVariants } from "@/lib/scalev/order-variants";

describe("groupScalevOrderVariants", () => {
  test("keeps a single line at quantity 1", () => {
    expect(
      groupScalevOrderVariants([
        { variant_unique_id: "variant-hot-stone", quantity: 1 },
      ])
    ).toEqual([{ variant_unique_id: "variant-hot-stone", quantity: 1 }]);
  });

  test("sums repeated variant ids into one line", () => {
    expect(
      groupScalevOrderVariants([
        { variant_unique_id: "variant-deep-sleep", quantity: 1 },
        { variant_unique_id: "variant-deep-sleep", quantity: 1 },
        { variant_unique_id: "variant-deep-sleep", quantity: 1 },
      ])
    ).toEqual([{ variant_unique_id: "variant-deep-sleep", quantity: 3 }]);
  });

  test("keeps the first-seen order for mixed duplicates", () => {
    expect(
      groupScalevOrderVariants([
        { variant_unique_id: "variant-hot-stone", quantity: 1 },
        { variant_unique_id: "variant-love-birds", quantity: 1 },
        { variant_unique_id: "variant-hot-stone", quantity: 1 },
      ])
    ).toEqual([
      { variant_unique_id: "variant-hot-stone", quantity: 2 },
      { variant_unique_id: "variant-love-birds", quantity: 1 },
    ]);
  });
});
