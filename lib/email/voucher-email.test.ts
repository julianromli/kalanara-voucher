import { createHash } from "node:crypto";
import { afterEach, describe, expect, test, vi } from "vitest";
import { getEmailIdempotencyKey, renderVoucherEmailHtml } from "@/lib/email/voucher-email";

const delivery = {
  orderId: "o1",
  voucherCode: "KSPV-001",
  recipientEmail: "r@example.com",
  recipientName: "Dias <b>",
  senderName: "Tri & co",
  senderMessage: 'Selamat "ya"',
  serviceName: "Balinese Massage",
  serviceDuration: 60,
  amount: 450000,
  expiryDate: "2027-01-01T00:00:00.000Z",
};

describe("voucher email template", () => {
  afterEach(() => vi.unstubAllEnvs());

  // The order flow keys Resend's 24h idempotency on a hash of this HTML. If
  // the bytes change, a retry right after deploy goes out as a second email.
  // This hash is the template as it was in the route before the extraction.
  test("renders byte-for-byte the same HTML as before the extraction", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://voucher.example.com");
    vi.stubEnv("VOUCHER_PDF_LINK_SECRET", "test-link-secret");
    const html = renderVoucherEmailHtml(delivery);
    expect(createHash("sha256").update(html).digest("hex")).toBe(
      "4e37c7b69b29167ab24279c5ea30bb3c25e856223a63b08f5c3f949fbf7ecb8b"
    );
    expect(getEmailIdempotencyKey(delivery, html)).toMatch(/^voucher-email-[a-f0-9]{64}$/);
  });
});
