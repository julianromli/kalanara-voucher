import { beforeEach, describe, expect, test, vi } from "vitest";

const { getAuthorizedVoucherDeliveryMock, resendSendMock, generateVoucherPdfMock } = vi.hoisted(() => ({
  getAuthorizedVoucherDeliveryMock: vi.fn(),
  resendSendMock: vi.fn(),
  generateVoucherPdfMock: vi.fn(),
}));

const voucherPdfBytes = Buffer.from("%PDF-1.3 voucher");

function pdfFile(contents: Buffer) {
  const bytes = Uint8Array.from(contents);
  return {
    arrayBuffer: async () => bytes.buffer,
  };
}

vi.mock("resend", () => ({
  Resend: class {
    emails = { send: resendSendMock };
  },
}));

vi.mock("@/lib/payment/public-voucher-delivery", () => ({
  getAuthorizedVoucherDelivery: getAuthorizedVoucherDeliveryMock,
}));

vi.mock("@/lib/pdf", () => ({
  generateVoucherPDF: generateVoucherPdfMock,
}));

describe("POST /api/email/send-voucher", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://voucher.example.com/");
    vi.stubEnv("VOUCHER_PDF_LINK_SECRET", "test-link-secret");
    getAuthorizedVoucherDeliveryMock.mockResolvedValue({
      orderId: "server-order-1",
      token: "server-token",
      voucherCode: "KSPV-001",
      recipientEmail: "recipient@example.com",
      recipientName: "Penerima",
      senderName: "Pengirim",
      senderMessage: null,
      serviceName: "Balinese Massage",
      serviceDuration: 60,
      amount: 450000,
      expiryDate: "2027-01-01T00:00:00.000Z",
    });
    resendSendMock.mockResolvedValue({
      data: { id: "email-1" },
      error: null,
    });
    generateVoucherPdfMock.mockResolvedValue(pdfFile(voucherPdfBytes));
  });

  test("returns 400 for malformed JSON", async () => {
    const { POST } = await import("@/app/api/email/send-voucher/route");

    const response = await POST(
      new Request("http://localhost/api/email/send-voucher", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{invalid",
      }) as never
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "Invalid JSON in request body",
    });
  });

  test("sends with a stable server-derived email idempotency key", async () => {
    const { POST } = await import("@/app/api/email/send-voucher/route");
    const makeRequest = () =>
      new Request("http://localhost/api/email/send-voucher", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-forwarded-for": "203.0.113.42",
        },
        body: JSON.stringify({
          orderId: "caller-controlled-order",
          token: "caller-controlled-token",
          orderItemId: "caller-controlled-item",
          idempotencyKey: "caller-controlled-key",
        }),
      }) as never;

    const firstResponse = await POST(makeRequest());
    const secondResponse = await POST(makeRequest());

    expect(firstResponse.status).toBe(200);
    expect(secondResponse.status).toBe(200);
    expect(resendSendMock).toHaveBeenCalledTimes(2);

    const firstOptions = resendSendMock.mock.calls[0][1];
    const secondOptions = resendSendMock.mock.calls[1][1];
    expect(firstOptions).toEqual({
      idempotencyKey: expect.stringMatching(/^voucher-email-[a-f0-9]{64}$/),
    });
    expect(secondOptions).toEqual(firstOptions);
    expect(firstOptions.idempotencyKey.length).toBeLessThanOrEqual(256);
    expect(firstOptions.idempotencyKey).not.toContain("caller-controlled");
  });

  test("uses a new idempotency key when rendered voucher content changes", async () => {
    const { POST } = await import("@/app/api/email/send-voucher/route");
    const makeRequest = () =>
      new Request("http://localhost/api/email/send-voucher", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-forwarded-for": "203.0.113.43",
        },
        body: JSON.stringify({
          orderId: "server-order-1",
          token: "server-token",
        }),
      }) as never;

    await POST(makeRequest());
    getAuthorizedVoucherDeliveryMock.mockResolvedValueOnce({
      orderId: "server-order-1",
      token: "server-token",
      voucherCode: "KSPV-001",
      recipientEmail: "recipient@example.com",
      recipientName: "Penerima",
      senderName: "Pengirim",
      senderMessage: "Pesan yang diperbarui",
      serviceName: "Balinese Massage",
      serviceDuration: 60,
      amount: 450000,
      expiryDate: "2027-02-01T00:00:00.000Z",
    });
    await POST(makeRequest());

    const firstKey = resendSendMock.mock.calls[0][1].idempotencyKey;
    const secondKey = resendSendMock.mock.calls[1][1].idempotencyKey;
    expect(secondKey).not.toBe(firstKey);
  });

  test("attaches the same voucher PDF that the buyer can download", async () => {
    const { POST } = await import("@/app/api/email/send-voucher/route");

    const response = await POST(
      new Request("http://localhost/api/email/send-voucher", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-forwarded-for": "203.0.113.44",
        },
        body: JSON.stringify({
          orderId: "server-order-1",
          token: "server-token",
        }),
      }) as never
    );

    expect(response.status).toBe(200);
    expect(generateVoucherPdfMock).toHaveBeenCalledWith({
      code: "KSPV-001",
      serviceName: "Balinese Massage",
      recipientName: "Penerima",
      senderName: "Pengirim",
      senderMessage: undefined,
      expiryDate: "2027-01-01T00:00:00.000Z",
    });

    const payload = resendSendMock.mock.calls[0][0];
    expect(payload.html).toContain("Your voucher PDF is attached to this email.");
    expect(payload.html).not.toContain("Jl. Raya Ubud");
    expect(payload.attachments).toEqual([
      {
        filename: "kalanara-voucher-KSPV-001.pdf",
        content: voucherPdfBytes.toString("base64"),
        contentType: "application/pdf",
      },
    ]);
  });

  test("links the download button to a signed PDF URL for this voucher", async () => {
    const { POST } = await import("@/app/api/email/send-voucher/route");
    const { signVoucherPdfCode } = await import("@/lib/payment/voucher-pdf-link");

    const response = await POST(
      new Request("http://localhost/api/email/send-voucher", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-forwarded-for": "203.0.113.46",
        },
        body: JSON.stringify({
          orderId: "server-order-1",
          token: "server-token",
        }),
      }) as never
    );

    expect(response.status).toBe(200);
    const payload = resendSendMock.mock.calls[0][0];
    const signature = signVoucherPdfCode("KSPV-001");
    expect(payload.html).toContain(
      `https://voucher.example.com/api/vouchers/pdf?code=KSPV-001&amp;sig=${signature}`
    );
    expect(payload.html).toContain("https://voucher.example.com/email/voucher-hero.jpg");
    expect(payload.html).not.toContain("server-token");
  });

  test("still sends the email without a download button when the link secret is missing", async () => {
    vi.stubEnv("VOUCHER_PDF_LINK_SECRET", "");
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { POST } = await import("@/app/api/email/send-voucher/route");

    const response = await POST(
      new Request("http://localhost/api/email/send-voucher", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-forwarded-for": "203.0.113.47",
        },
        body: JSON.stringify({
          orderId: "server-order-1",
          token: "server-token",
        }),
      }) as never
    );

    expect(response.status).toBe(200);
    const payload = resendSendMock.mock.calls[0][0];
    expect(payload.html).not.toContain("/api/vouchers/pdf");
    expect(payload.html).toContain("Show on arrival");
    expect(payload.attachments).toHaveLength(1);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  test("does not send the email when the voucher PDF is invalid", async () => {
    generateVoucherPdfMock.mockResolvedValueOnce(pdfFile(Buffer.from("not-a-pdf")));
    const { POST } = await import("@/app/api/email/send-voucher/route");

    const response = await POST(
      new Request("http://localhost/api/email/send-voucher", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-forwarded-for": "203.0.113.45",
        },
        body: JSON.stringify({
          orderId: "server-order-1",
          token: "server-token",
        }),
      }) as never
    );

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      error: "Failed to generate voucher PDF",
    });
    expect(resendSendMock).not.toHaveBeenCalled();
  });
});
