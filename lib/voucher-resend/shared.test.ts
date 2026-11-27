import { describe, expect, test } from "vitest";
import { isValidEmailAddress, sameEmailAddress } from "@/lib/email-address";
import {
  deliveryStatusLine,
  resendBlockedReason,
  resendFailureMessage,
  type VoucherDeliveryOverview,
} from "@/lib/voucher-resend/shared";

function overview(partial: Partial<VoucherDeliveryOverview> = {}): VoucherDeliveryOverview {
  return {
    voucherId: "v1",
    orderItemId: "i1",
    code: "KSP-2026-TEST0001",
    serviceName: "Love Birds 1",
    recipientName: "Dias",
    recipientEmail: "dias@gmail.com",
    buyerEmail: "buyer@gmail.com",
    whatsAppTarget: null,
    isRedeemed: false,
    isExpired: false,
    email: { state: "SENT", at: "2026-11-27T09:51:41.000Z" },
    lastResend: null,
    ...partial,
  };
}

describe("email address checks", () => {
  test.each(["nama@gmail.com", "a.b+c@yahoo.co.id", "x@i-dacasia.com"])("accepts %s", (email) => {
    expect(isValidEmailAddress(email)).toBe(true);
  });

  test.each(["nama@gmail", "nama@", "@gmail.com", "nama gmail.com", "nama@gmail.c", ""])(
    "rejects %s",
    (email) => {
      expect(isValidEmailAddress(email)).toBe(false);
    },
  );

  test("compares addresses without case or spaces", () => {
    expect(sameEmailAddress(" Dias@Gmail.com ", "dias@gmail.com")).toBe(true);
    expect(sameEmailAddress(null, "dias@gmail.com")).toBe(false);
  });
});

describe("delivery status line", () => {
  test("shows the order email time in Jakarta time", () => {
    expect(deliveryStatusLine(overview())).toEqual({
      tone: "ok",
      text: "Email terkirim ke dias@gmail.com · 27 Nov 16.51",
    });
  });

  test("says when a voucher was never emailed", () => {
    expect(deliveryStatusLine(overview({ email: { state: "NONE", at: null } }))).toEqual({
      tone: "muted",
      text: "Belum pernah dikirim lewat email",
    });
  });

  test("a newer resend wins over the order email", () => {
    const line = deliveryStatusLine(
      overview({
        lastResend: { status: "FAILED", to: "dias@gmail.con", at: "2026-11-27T13:00:00.000Z", by: null },
      }),
    );
    expect(line.tone).toBe("error");
    expect(line.text).toBe("Kirim ulang ke dias@gmail.con gagal · 27 Nov 20.00");
  });

  test("an older resend loses to a newer order email", () => {
    const line = deliveryStatusLine(
      overview({
        lastResend: { status: "SENT", to: "old@gmail.com", at: "2026-11-27T08:00:00.000Z", by: null },
      }),
    );
    expect(line).toEqual({ tone: "ok", text: "Email terkirim ke dias@gmail.com · 27 Nov 16.51" });
  });

  test.each([
    ["SENT", "ok", "Dikirim ulang ke dias@gmail.com · 27 Nov 20.00"],
    ["PENDING", "muted", "Kirim ulang ke dias@gmail.com belum selesai · 27 Nov 20.00"],
  ] as const)("shows a %s resend", (status, tone, text) => {
    const line = deliveryStatusLine(
      overview({ lastResend: { status, to: "dias@gmail.com", at: "2026-11-27T13:00:00.000Z", by: null } }),
    );
    expect(line.tone).toBe(tone);
    expect(line.text).toBe(text);
  });

  test.each([
    ["FAILED", "error", "Email gagal dikirim · 27 Nov 16.51"],
    ["PENDING", "muted", "Email sedang diproses"],
  ] as const)("shows a %s order email", (state, tone, text) => {
    const line = deliveryStatusLine(overview({ email: { state, at: "2026-11-27T09:51:41.000Z" } }));
    expect(line).toEqual({ tone, text });
  });

  test("blocks redeemed and expired vouchers with a reason", () => {
    expect(resendBlockedReason(overview({ isRedeemed: true }))).toBe("Voucher sudah dipakai.");
    expect(resendBlockedReason(overview({ isExpired: true }))).toBe("Voucher sudah kedaluwarsa.");
    expect(resendBlockedReason(overview())).toBeNull();
  });
});

describe("resend messages", () => {
  test("says Koneksi putus only for a network failure", () => {
    expect(resendFailureMessage("network")).toMatch(/^Koneksi putus/);
    expect(resendFailureMessage("error")).not.toMatch(/Koneksi putus/);
    expect(resendFailureMessage("provider_error")).not.toMatch(/Koneksi putus/);
  });

  test("puts the wait time in rate limit and cooldown messages", () => {
    expect(resendFailureMessage("cooldown", 42)).toBe("Tunggu 42 detik sebelum kirim ulang lagi.");
    expect(resendFailureMessage("rate_limited", 1790)).toBe(
      "Voucher ini sudah dikirim ulang 3 kali dalam 1 jam. Coba lagi 30 menit lagi.",
    );
  });
});

describe("email typo suggestions", () => {
  test.each([
    ["dias@gmail.con", "dias@gmail.com"],
    ["dias@gmai.com", "dias@gmail.com"],
    ["dias@gmial.com", "dias@gmail.com"],
    ["dias@gmail", "dias@gmail.com"],
    ["dias@yahooo.com", "dias@yahoo.com"],
    ["dias@yahoo.co.di", "dias@yahoo.co.id"],
    ["Dias@GMAIL.CON", "Dias@gmail.com"],
    ["nama@ymail", "nama@ymail.com"],
  ])("suggests %s -> %s", async (input, expected) => {
    const { suggestEmailFix } = await import("@/lib/email-address");
    expect(suggestEmailFix(input)).toBe(expected);
  });

  test.each(["dias@gmail.com", "dias@mail.com", "dias@yahoo.co.jp", "dias@i-dacasia.com", "dias@kalanaraspa.com"])(
    "leaves %s alone",
    async (input) => {
      const { suggestEmailFix } = await import("@/lib/email-address");
      expect(suggestEmailFix(input)).toBeNull();
    },
  );

  test("never suggests an address that would still be invalid", async () => {
    const { suggestEmailFix, emailFieldProblem } = await import("@/lib/email-address");
    expect(suggestEmailFix("bad space@gmail.con")).toBeNull();
    expect(emailFieldProblem("bad space@gmail.con")).toBe("Format email tidak valid");
  });

  test("field message: typo first, then format, empty passes", async () => {
    const { emailFieldProblem } = await import("@/lib/email-address");
    expect(emailFieldProblem("tri@gmail.con")).toBe("Cek lagi emailnya. Maksudnya tri@gmail.com?");
    expect(emailFieldProblem("tri@kantor")).toBe("Format email tidak valid");
    expect(emailFieldProblem("")).toBeNull();
    expect(emailFieldProblem("tri@gmail.com")).toBeNull();
  });
});
