import { describe, expect, test } from "vitest";
import { toIsoDateTimeValue } from "@/components/admin/discount-codes-client";

describe("toIsoDateTimeValue", () => {
  test("converts datetime-local values to ISO timestamps before submission", () => {
    const input = "2026-05-04T14:00";

    expect(toIsoDateTimeValue(input)).toBe(new Date(input).toISOString());
  });

  test("preserves empty values as null", () => {
    expect(toIsoDateTimeValue("")).toBeNull();
    expect(toIsoDateTimeValue(null)).toBeNull();
  });

  test("returns null for malformed non-empty datetime values", () => {
    expect(toIsoDateTimeValue("not-a-date")).toBeNull();
  });
});
