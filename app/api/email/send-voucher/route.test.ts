import { beforeEach, describe, expect, test, vi } from "vitest";

const { getAuthorizedVoucherDeliveryMock, resendSendMock } = vi.hoisted(() => ({
  getAuthorizedVoucherDeliveryMock: vi.fn(),
  resendSendMock: vi.fn(),
}));

vi.mock("resend", () => ({
  Resend: class {
    emails = { send: resendSendMock };
  },
}));

vi.mock("@/lib/payment/public-voucher-delivery", () => ({
  getAuthorizedVoucherDelivery: getAuthorizedVoucherDeliveryMock,
}));

describe("POST /api/email/send-voucher", () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
});
