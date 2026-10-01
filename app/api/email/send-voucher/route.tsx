import { createHash } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { render, toPlainText } from "react-email";
import { Resend } from "resend";
import {
  getAuthorizedVoucherDelivery,
  type AuthorizedVoucherDelivery,
} from "@/lib/payment/public-voucher-delivery";
import { VoucherGiftEmail } from "@/lib/emails/voucher-gift-email";

const resend = new Resend(process.env.RESEND_API_KEY);

// Simple in-memory rate limiter (for production, consider Redis/Upstash)
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(ip: string, limit = 10, windowMs = 60000): boolean {
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

interface VoucherEmailRequest {
  orderId: string;
  token: string;
  orderItemId?: string;
}

function sanitizeHeaderValue(value: string): string {
  return value.replace(/[\r\n]+/g, " ").trim();
}

function getEmailIdempotencyKey(
  delivery: AuthorizedVoucherDelivery
): string {
  const deliveryIdentity = JSON.stringify({
    channel: "EMAIL",
    orderId: delivery.orderId,
    voucherCode: delivery.voucherCode,
    recipientEmail: delivery.recipientEmail?.trim().toLowerCase() ?? "",
    recipientName: delivery.recipientName,
    senderName: delivery.senderName,
    senderMessage: delivery.senderMessage,
    serviceName: delivery.serviceName,
    serviceDuration: delivery.serviceDuration,
    amount: delivery.amount,
    expiryDate: delivery.expiryDate,
  });
  const digest = createHash("sha256").update(deliveryIdentity).digest("hex");
  return `voucher-email-${digest}`;
}

export async function POST(request: NextRequest) {
  try {
    // Rate limiting to prevent abuse
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0] ||
               request.headers.get("x-real-ip") ||
               "unknown";
    if (!checkRateLimit(ip)) {
      return NextResponse.json(
        { error: "Too many requests. Please try again later." },
        { status: 429 }
      );
    }

    const body = (await request.json().catch((error: unknown) => {
      throw error;
    })) as VoucherEmailRequest;

    const { orderId, token, orderItemId } = body;

    if (!orderId || !token) {
      return NextResponse.json(
        { error: "orderId and token are required" },
        { status: 400 }
      );
    }

    const delivery = await getAuthorizedVoucherDelivery(orderId, token, orderItemId);
    if (!delivery || !delivery.recipientEmail) {
      return NextResponse.json(
        { error: "Voucher tidak valid atau email penerima tidak tersedia." },
        { status: 400 }
      );
    }

    const formattedAmount = new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      minimumFractionDigits: 0,
    }).format(delivery.amount);

    const formattedExpiry = new Date(delivery.expiryDate).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });

    const emailHtml = await render(
      <VoucherGiftEmail
        recipientName={delivery.recipientName}
        senderName={delivery.senderName}
        senderMessage={delivery.senderMessage ?? null}
        voucherCode={delivery.voucherCode}
        serviceName={delivery.serviceName}
        serviceDuration={delivery.serviceDuration}
        formattedAmount={formattedAmount}
        formattedExpiry={formattedExpiry}
      />
    );

    const { data, error } = await resend.emails.send(
      {
        from: "Kalanara Spa <noreply@voucher.kalanaraspa.com>",
        to: [delivery.recipientEmail],
        subject: `🎁 ${sanitizeHeaderValue(delivery.senderName)} sent you a gift from Kalanara Spa!`,
        html: emailHtml,
        text: toPlainText(emailHtml),
      },
      { idempotencyKey: getEmailIdempotencyKey(delivery) }
    );

    if (error) {
      console.error("Failed to send email:", error);
      return NextResponse.json(
        { error: "Failed to send email" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, messageId: data?.id });
  } catch (error) {
    console.error("Email API error:", error);

    if (error instanceof SyntaxError) {
      return NextResponse.json(
        { error: "Invalid JSON in request body" },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}