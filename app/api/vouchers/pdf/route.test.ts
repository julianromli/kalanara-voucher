import { beforeEach, describe, expect, test, vi } from "vitest";

const { getVoucherByCodeMock, generateVoucherPdfMock } = vi.hoisted(() => ({
  getVoucherByCodeMock: vi.fn(),
  generateVoucherPdfMock: vi.fn(),
}));

const voucherPdfBytes = Buffer.from("%PDF-1.3 voucher");

function pdfFile(contents: Buffer) {
  const bytes = Uint8Array.from(contents);
  return {
    arrayBuffer: async () => bytes.buffer,
  };
}

vi.mock("@/lib/actions/vouchers", () => ({
  getVoucherByCode: getVoucherByCodeMock,
}));

vi.mock("@/lib/pdf", () => ({
  generateVoucherPDF: generateVoucherPdfMock,
}));

let requestCount = 0;

async function download(code: string | null, sig: string | null) {
  const { GET } = await import("@/app/api/vouchers/pdf/route");
  const { NextRequest } = await import("next/server");
  const url = new URL("http://localhost/api/vouchers/pdf");
  if (code !== null) url.searchParams.set("code", code);
  if (sig !== null) url.searchParams.set("sig", sig);
  requestCount++;
  return GET(
    new NextRequest(url, {
      headers: { "x-forwarded-for": `198.51.100.${requestCount}` },
    })
  );
}

describe("GET /api/vouchers/pdf", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("VOUCHER_PDF_LINK_SECRET", "test-link-secret");
    getVoucherByCodeMock.mockResolvedValue({
      code: "KSPV-001",
      recipient_name: "Penerima",
      sender_name: "Pengirim",
      sender_message: null,
      expiry_date: "2999-01-01T00:00:00.000Z",
      services: { name: "Balinese Massage" },
    });
    generateVoucherPdfMock.mockResolvedValue(pdfFile(voucherPdfBytes));
  });

  test("returns the voucher PDF for a valid signed link", async () => {
    const { signVoucherPdfCode } = await import("@/lib/payment/voucher-pdf-link");

    const response = await download("kspv-001", signVoucherPdfCode("KSPV-001"));

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("application/pdf");
    expect(response.headers.get("Content-Disposition")).toBe(
      'attachment; filename="kalanara-voucher-KSPV-001.pdf"'
    );
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(Buffer.from(await response.arrayBuffer())).toEqual(voucherPdfBytes);
    expect(getVoucherByCodeMock).toHaveBeenCalledWith("KSPV-001");
    expect(generateVoucherPdfMock).toHaveBeenCalledWith({
      code: "KSPV-001",
      serviceName: "Balinese Massage",
      recipientName: "Penerima",
      senderName: "Pengirim",
      senderMessage: undefined,
      expiryDate: "2999-01-01T00:00:00.000Z",
    });
  });

  test("returns 400 when the code or signature is missing", async () => {
    expect((await download("KSPV-001", null)).status).toBe(400);
    expect((await download(null, "sig")).status).toBe(400);
    expect(getVoucherByCodeMock).not.toHaveBeenCalled();
  });

  test("rejects a signature made for another voucher", async () => {
    const { signVoucherPdfCode } = await import("@/lib/payment/voucher-pdf-link");

    const response = await download("KSPV-002", signVoucherPdfCode("KSPV-001"));

    expect(response.status).toBe(403);
    expect(getVoucherByCodeMock).not.toHaveBeenCalled();
  });

  test("returns 410 after the voucher has expired", async () => {
    const { signVoucherPdfCode } = await import("@/lib/payment/voucher-pdf-link");
    getVoucherByCodeMock.mockResolvedValueOnce({
      code: "KSPV-001",
      recipient_name: "Penerima",
      sender_name: "Pengirim",
      sender_message: null,
      expiry_date: "2020-01-01T00:00:00.000Z",
      services: { name: "Balinese Massage" },
    });

    const response = await download("KSPV-001", signVoucherPdfCode("KSPV-001"));

    expect(response.status).toBe(410);
    expect(generateVoucherPdfMock).not.toHaveBeenCalled();
  });

  test("returns 404 when the voucher does not exist", async () => {
    const { signVoucherPdfCode } = await import("@/lib/payment/voucher-pdf-link");
    getVoucherByCodeMock.mockResolvedValueOnce(null);

    const response = await download("KSPV-404", signVoucherPdfCode("KSPV-404"));

    expect(response.status).toBe(404);
  });
});
