import { NextRequest, NextResponse } from "next/server";
import { getVoucherByCode } from "@/lib/actions/vouchers";
import { generateVoucherPDF } from "@/lib/pdf";
import {
  isValidVoucherPdfSignature,
  normalizeVoucherCode,
  toVoucherPdfBytes,
  voucherPdfFilename,
} from "@/lib/payment/voucher-pdf-link";

// Simple in-memory rate limiter (for production, consider Redis/Upstash)
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(ip: string, limit = 20, windowMs = 60000): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);

  if (!entry || entry.resetAt < now) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + windowMs });
    return true;
  }

  if (entry.count >= limit) return false;
  entry.count++;
  return true;
}

// The link is opened in a browser from an email, so errors are plain text.
function textResponse(message: string, status: number) {
  return new NextResponse(message, {
    status,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

/**
 * GET /api/vouchers/pdf?code=...&sig=...
 *
 * Downloads the voucher PDF from the signed link in the voucher email.
 */
export async function GET(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0] ||
             request.headers.get("x-real-ip") ||
             "unknown";
  if (!checkRateLimit(ip)) {
    return textResponse("Terlalu banyak permintaan. Silakan coba lagi nanti.", 429);
  }

  const code = request.nextUrl.searchParams.get("code");
  const signature = request.nextUrl.searchParams.get("sig");
  if (!code || !signature) {
    return textResponse("Tautan voucher tidak valid.", 400);
  }

  try {
    const normalizedCode = normalizeVoucherCode(code);
    if (!isValidVoucherPdfSignature(normalizedCode, signature)) {
      return textResponse("Tautan voucher tidak valid.", 403);
    }

    const voucher = await getVoucherByCode(normalizedCode);
    if (!voucher) {
      return textResponse("Voucher tidak ditemukan.", 404);
    }

    if (new Date(voucher.expiry_date).getTime() < Date.now()) {
      return textResponse("Voucher ini sudah kedaluwarsa.", 410);
    }

    const blob = await generateVoucherPDF({
      code: voucher.code,
      serviceName: voucher.services.name,
      recipientName: voucher.recipient_name,
      senderName: voucher.sender_name,
      senderMessage: voucher.sender_message || undefined,
      expiryDate: voucher.expiry_date,
    });
    const bytes = await toVoucherPdfBytes(blob);

    return new NextResponse(new Uint8Array(bytes), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${voucherPdfFilename(voucher.code)}"`,
        "Content-Length": String(bytes.length),
        "Cache-Control": "private, no-store",
        "X-Robots-Tag": "noindex",
      },
    });
  } catch (error) {
    console.error("Voucher PDF download error:", error);
    return textResponse("Gagal membuat PDF voucher. Silakan coba lagi nanti.", 500);
  }
}
