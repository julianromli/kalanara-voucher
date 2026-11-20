import { describe, expect, test } from "vitest";
import { normalizeMemberPhone } from "@/lib/membership/phone";
import { isLookupPhonePrefixVisible, parseMemberScan } from "@/lib/membership/scan";
import { fillFollowupTemplate } from "@/lib/membership/templates";

const token = "a".repeat(48);
const appUrl = "https://voucher.kalanaraspa.com";

describe("member scan and phone", () => {
  test("accepts the same member from local and international numbers", () => {
    expect(normalizeMemberPhone("0812-3456-7890")).toBe("6281234567890");
    expect(normalizeMemberPhone("81234567890")).toBe("6281234567890");
    expect(normalizeMemberPhone("+62 812 3456 7890")).toBe("6281234567890");
    expect(normalizeMemberPhone("+62 (0) 812 3456 7890")).toBe("6281234567890");
    expect(normalizeMemberPhone("0062 812 3456 7890")).toBe("6281234567890");
    expect(parseMemberScan("(0812) 3456-7890", { appUrl })).toEqual({
      kind: "phone",
      phone: "6281234567890",
    });
  });

  test("does not treat a labeled order reference as a phone", () => {
    expect(parseMemberScan("Order 0812-3456-7890", { appUrl })).toEqual({
      kind: "rejected",
    });
  });

  test("reads a card URL on the public host or the current origin", () => {
    expect(
      parseMemberScan(`${appUrl}/m/${token}`, { appUrl }),
    ).toEqual({ kind: "token", token });
    expect(
      parseMemberScan(`http://localhost:3000/m/${token}`, {
        appUrl,
        origin: "http://localhost:3000",
      }),
    ).toEqual({ kind: "token", token });
  });

  test("rejects a card URL on another host", () => {
    expect(
      parseMemberScan(`https://example.com/m/${token}`, { appUrl }),
    ).toEqual({ kind: "rejected" });
    expect(
      parseMemberScan(`${appUrl}/voucher/KSP-2026-ABCDEFGH`, { appUrl }),
    ).toEqual({ kind: "rejected" });
  });

  test("fills the follow-up placeholders", () => {
    const text = fillFollowupTemplate(
      "Halo {nama}, {treatment_terakhir}, {link_kartu}",
      {
        nama: "Rani",
        treatment: "Body Massage 60 menit",
        stamp: "4",
        sisa: "1",
        reward_berikutnya: "Totok gratis",
        link_kartu: `${appUrl}/m/${token}`,
        tanggal_akhir: "25 Nov 2026",
      },
    );

    expect(text).toContain("Halo Rani");
    expect(text).toContain("Body Massage 60 menit");
    expect(text).toContain(`${appUrl}/m/${token}`);
  });

  test("shows the +62 prefix only for an empty or phone-shaped lookup", () => {
    expect(isLookupPhonePrefixVisible("")).toBe(true);
    expect(isLookupPhonePrefixVisible("   ")).toBe(true);
    expect(isLookupPhonePrefixVisible("81234567890")).toBe(true);
    expect(isLookupPhonePrefixVisible("0812 3456 7890")).toBe(true);
    expect(isLookupPhonePrefixVisible("+6281234567890")).toBe(true);
    expect(isLookupPhonePrefixVisible(`${appUrl}/m/${token}`)).toBe(false);
    expect(isLookupPhonePrefixVisible(`http://localhost:3000/m/${token}`)).toBe(false);
    expect(isLookupPhonePrefixVisible(token)).toBe(false);
  });
});
