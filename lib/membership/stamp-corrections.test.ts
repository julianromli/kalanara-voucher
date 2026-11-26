import { describe, expect, test } from "vitest";
import {
  claimWarning,
  isStampDateAllowed,
  isoToLocalDate,
  localDateToISO,
  parseStampHistory,
  shiftISODate,
  stampAuditSummary,
  stampCorrectionMessage,
  stampDateBounds,
} from "@/lib/membership/stamp-corrections";

describe("stampDateBounds", () => {
  test("caps the last day at today inside the period", () => {
    expect(stampDateBounds({ cycleStart: "2026-03-12", resetOn: "2027-03-12", today: "2026-11-26" })).toEqual({
      min: "2026-03-12",
      max: "2026-11-26",
    });
  });

  test("caps the last day at the day before reset", () => {
    expect(stampDateBounds({ cycleStart: "2026-03-12", resetOn: "2027-03-12", today: "2027-03-20" })).toEqual({
      min: "2026-03-12",
      max: "2027-03-11",
    });
  });

  test("allows only real dates inside the bounds", () => {
    const bounds = { min: "2026-03-12", max: "2026-11-26" };
    expect(isStampDateAllowed("2026-03-12", bounds)).toBe(true);
    expect(isStampDateAllowed("2026-11-26", bounds)).toBe(true);
    expect(isStampDateAllowed("2026-03-11", bounds)).toBe(false);
    expect(isStampDateAllowed("2026-11-27", bounds)).toBe(false);
    expect(isStampDateAllowed("", bounds)).toBe(false);
    expect(isStampDateAllowed("2026-04-31", bounds)).toBe(false);
  });

  test("shifts across month and leap-year edges", () => {
    expect(shiftISODate("2028-03-01", -1)).toBe("2028-02-29");
    expect(shiftISODate("2026-12-31", 1)).toBe("2027-01-01");
  });

  test("round-trips a calendar date through a local Date", () => {
    expect(localDateToISO(isoToLocalDate("2026-11-05"))).toBe("2026-11-05");
  });
});

describe("parseStampHistory", () => {
  test("keeps voided stamps and audit rows, drops unknown actions", () => {
    const history = parseStampHistory({
      status: "ok",
      cycle_start: "2026-03-12",
      reset_on: "2027-03-12",
      today: "2026-11-26",
      stamps: [
        {
          id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
          visit_date: "2026-11-20",
          service_id: null,
          service_name: "Deep Sleep",
          created_at: "2026-11-20T03:00:00Z",
          created_by_name: "Rina Kasir",
          voided_at: "2026-11-26T03:00:00Z",
          voided_by_name: "Wildan",
        },
      ],
      audit: [
        {
          id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
          stamp_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
          action: "void",
          old_value: "aktif",
          new_value: "dibatalkan",
          service_name: "Deep Sleep",
          visit_date: "2026-11-20",
          reason: "salah member",
          details: { claims_kept: [{ milestone: 5, reward_name: "Treatment gratis" }] },
          changed_by_email: "wildan@kalanaraspa.com",
          changed_by_role: "STAFF",
          changed_by_name: "Wildan",
          created_at: "2026-11-26T03:00:00Z",
        },
        { id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc", action: "drop_table" },
      ],
    });
    expect(history?.stamps[0].voidedAt).toBe("2026-11-26T03:00:00Z");
    expect(history?.audit).toHaveLength(1);
    expect(history?.audit[0].claimsKept).toEqual([{ milestone: 5, rewardName: "Treatment gratis" }]);
  });

  test("rejects a non-ok body", () => {
    expect(parseStampHistory({ status: "not_found" })).toBeNull();
    expect(parseStampHistory(null)).toBeNull();
  });
});

describe("copy", () => {
  test("claim warning names the reward and the new count", () => {
    expect(claimWarning([{ milestone: 5, rewardName: "Treatment gratis" }], 4)).toBe(
      "Reward Treatment gratis (5 stamp) udah diklaim di periode ini. Stamp jadi 4. Klaimnya tetap tercatat dan nggak bisa diklaim dobel.",
    );
  });

  test("says Koneksi putus only for network failures", () => {
    expect(stampCorrectionMessage("network")).toContain("Koneksi putus");
    expect(stampCorrectionMessage("error")).not.toContain("Koneksi putus");
    expect(stampCorrectionMessage("invalid_service")).not.toContain("Koneksi putus");
  });

  test("names the period when a date is outside it", () => {
    expect(
      stampCorrectionMessage("outside_period", { cycleStart: "2026-03-12", resetOn: "2027-03-12" }),
    ).toBe("Tanggalnya harus di periode ini: 12 Mar 2026 sampai sebelum 12 Mar 2027.");
    expect(stampCorrectionMessage("future_date")).toBe("Tanggal kunjungan nggak boleh setelah hari ini.");
  });

  test("summarises each audit action", () => {
    const base = {
      id: "x",
      stampId: "y",
      serviceName: "Me Time",
      visitDate: "2026-11-20",
      reason: null,
      claimsKept: [],
      changedByName: null,
      changedByEmail: null,
      changedByRole: null,
      createdAt: "2026-11-26T03:00:00Z",
    };
    expect(stampAuditSummary({ ...base, action: "service", oldValue: "Deep Sleep", newValue: "Me Time" })).toBe(
      "Treatment: Deep Sleep → Me Time",
    );
    expect(stampAuditSummary({ ...base, action: "visit_date", oldValue: "2026-11-21", newValue: "2026-11-20" })).toBe(
      "Tanggal Me Time: 21 Nov 2026 → 20 Nov 2026",
    );
    expect(stampAuditSummary({ ...base, action: "void", oldValue: "aktif", newValue: "dibatalkan" })).toBe(
      "Hapus stamp Me Time · 20 Nov 2026",
    );
    expect(stampAuditSummary({ ...base, action: "add_past", oldValue: null, newValue: "2026-11-20" })).toBe(
      "Tambah stamp lama Me Time · 20 Nov 2026",
    );
  });
});
