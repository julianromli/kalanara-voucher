import { describe, expect, test } from "vitest";
import { render } from "react-email";
import {
  VoucherGiftEmail,
  type VoucherGiftEmailProps,
} from "@/lib/emails/voucher-gift-email";

const baseProps = {
  recipientName: "Faizin",
  senderName: "Faizin",
  senderMessage: "Selamat menikmati waktu relaksasiimu!",
  voucherCode: "KSP-2026-U5351Y1T",
  serviceName: "[TEST] Mini Voucher",
  serviceDuration: 15,
  formattedAmount: "Rp 10.000",
  formattedExpiry: "March 30, 2027",
};

async function renderEmail(overrides: Partial<VoucherGiftEmailProps> = {}) {
  return render(<VoucherGiftEmail {...baseProps} {...overrides} />);
}

describe("VoucherGiftEmail", () => {
  test("renders voucher and recipient details", async () => {
    const html = await renderEmail();

    expect(html).toContain("KSP-2026-U5351Y1T");
    expect(html).toContain("Faizin");
    expect(html).toContain("[TEST] Mini Voucher");
    expect(html).toContain("15 mins");
    expect(html).toContain("Rp 10.000");
    expect(html).toContain("March 30, 2027");
    expect(html).toContain("How to Redeem");
  });

  test("renders the personal message when provided", async () => {
    const html = await renderEmail();

    expect(html).toContain("Selamat menikmati waktu relaksasiimu!");
  });

  test("omits the personal message box when there is no message", async () => {
    const html = await renderEmail({ senderMessage: null });

    expect(html).not.toContain("Selamat menikmati waktu relaksasiimu!");
  });

  test("escapes user-provided content", async () => {
    const html = await renderEmail({
      senderMessage: "<script>alert('x')</script>",
      serviceName: "<b>Bold</b> Massage",
    });

    expect(html).not.toContain("<script>alert('x')</script>");
    expect(html).toContain("&lt;script&gt;");
    expect(html).not.toContain("<b>Bold</b>");
  });
});