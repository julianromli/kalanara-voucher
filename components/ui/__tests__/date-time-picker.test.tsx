import { describe, expect, test } from "vitest";
import { clampDateTime, formatDateTimeLocal, parseDateTimeLocal } from "@/components/ui/date-time-picker";
import { parseTime } from "@/components/ui/time-picker";

describe("date and time helpers", () => {
  test("round-trips a local datetime without treating it as UTC", () => {
    const date = parseDateTimeLocal("2026-11-26T09:00");
    expect(date?.getFullYear()).toBe(2026);
    expect(date?.getMonth()).toBe(10);
    expect(date?.getDate()).toBe(26);
    expect(date?.getHours()).toBe(9);
    expect(date?.getMinutes()).toBe(0);
    expect(formatDateTimeLocal(date!)).toBe("2026-11-26T09:00");
  });

  test("parses a full ISO timestamp", () => {
    const date = parseDateTimeLocal("2026-11-26T02:00:00.000Z");
    expect(date).toBeDefined();
    expect(date?.toISOString()).toBe("2026-11-26T02:00:00.000Z");
  });

  test("rejects an overflowing ISO timestamp", () => {
    expect(parseDateTimeLocal("2026-02-31T09:00:00.000Z")).toBeUndefined();
  });

  test("parses an ISO timestamp with an offset", () => {
    const date = parseDateTimeLocal("2026-11-26T09:00:00+07:00");
    expect(date?.toISOString()).toBe("2026-11-26T02:00:00.000Z");
  });

  test("rejects impossible local dates and times", () => {
    expect(parseDateTimeLocal("2026-02-31T09:00")).toBeUndefined();
    expect(parseDateTimeLocal("2026-11-26T09:60")).toBeUndefined();
    expect(parseDateTimeLocal("2026-11-26T24:00")).toBeUndefined();
  });

  test("parses HH:mm and rejects invalid times", () => {
    expect(parseTime("09:00")).toBe("09:00");
    expect(parseTime("18:00:00")).toBe("18:00");
    expect(parseTime("24:00")).toBe("");
    expect(parseTime("09:60")).toBe("");
    expect(parseTime("09:000")).toBe("");
    expect(parseTime("09:00:99")).toBe("");
    expect(parseTime("9:00")).toBe("");
  });

  test("clamps a datetime to min and max", () => {
    const min = parseDateTimeLocal("2026-11-26T09:00")!;
    const max = parseDateTimeLocal("2026-11-26T17:00")!;
    expect(formatDateTimeLocal(clampDateTime(parseDateTimeLocal("2026-11-26T08:00")!, min, max))).toBe(
      "2026-11-26T09:00",
    );
    expect(formatDateTimeLocal(clampDateTime(parseDateTimeLocal("2026-11-26T18:00")!, min, max))).toBe(
      "2026-11-26T17:00",
    );
    expect(formatDateTimeLocal(clampDateTime(parseDateTimeLocal("2026-11-26T12:00")!, min, max))).toBe(
      "2026-11-26T12:00",
    );
  });

  test("rounds a second-level min up to the next minute", () => {
    const min = new Date(2026, 10, 26, 9, 0, 30);
    expect(formatDateTimeLocal(clampDateTime(new Date(2026, 10, 26, 9, 0, 0), min))).toBe("2026-11-26T09:01");
  });
});
