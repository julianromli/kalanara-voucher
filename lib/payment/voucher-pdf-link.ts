import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";

// Bump the version to invalidate every download link sent so far.
const LINK_SIGNATURE_VERSION = "voucher-pdf-v1";
const PDF_HEADER = Buffer.from("%PDF");

function getLinkSecret(): string {
  const secret = process.env.VOUCHER_PDF_LINK_SECRET?.trim();

  if (!secret) {
    throw new Error("Missing required environment variable: VOUCHER_PDF_LINK_SECRET");
  }

  return secret;
}

export function getAppUrl(): string {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.trim();

  if (!appUrl) {
    throw new Error("Missing required environment variable: NEXT_PUBLIC_APP_URL");
  }

  return appUrl.replace(/\/+$/, "");
}

export function normalizeVoucherCode(code: string): string {
  return code.trim().toUpperCase();
}

export function signVoucherPdfCode(code: string): string {
  return createHmac("sha256", getLinkSecret())
    .update(`${LINK_SIGNATURE_VERSION}:${normalizeVoucherCode(code)}`)
    .digest("base64url");
}

export function isValidVoucherPdfSignature(code: string, signature: string): boolean {
  const expected = Buffer.from(signVoucherPdfCode(code));
  const actual = Buffer.from(signature);

  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

/**
 * Builds the link a recipient opens to download the voucher PDF. It grants
 * access to this one voucher only; the endpoint stops serving it after the
 * voucher's expiry date.
 */
export function buildVoucherPdfUrl(code: string): string {
  const normalizedCode = normalizeVoucherCode(code);
  const url = new URL("/api/vouchers/pdf", getAppUrl());
  url.searchParams.set("code", normalizedCode);
  url.searchParams.set("sig", signVoucherPdfCode(normalizedCode));
  return url.toString();
}

export function voucherPdfFilename(voucherCode: string): string {
  const safeCode = voucherCode.replace(/[^A-Za-z0-9-]/g, "");
  return `kalanara-voucher-${safeCode || "voucher"}.pdf`;
}

export async function toVoucherPdfBytes(blob: Blob): Promise<Buffer> {
  const bytes = Buffer.from(await blob.arrayBuffer());
  if (
    bytes.length < PDF_HEADER.length ||
    !bytes.subarray(0, PDF_HEADER.length).equals(PDF_HEADER)
  ) {
    throw new Error("Generated voucher PDF is empty or invalid");
  }

  return bytes;
}
