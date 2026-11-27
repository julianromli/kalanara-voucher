import { NextRequest, NextResponse } from "next/server";
import { createRateLimiter, getClientIp } from "@/lib/rate-limit";
import { getAuthorizedVoucherDelivery } from "@/lib/payment/public-voucher-delivery";
import {
  getEmailIdempotencyKey,
  renderVoucherEmailHtml,
  sendVoucherEmailMessage,
  voucherGiftSubject,
} from "@/lib/email/voucher-email";

const checkRateLimit = createRateLimiter({ limit: 10, windowMs: 60000 });

interface VoucherEmailRequest {
  orderId: string;
  token: string;
  orderItemId?: string;
}

export async function POST(request: NextRequest) {
  try {
    // Rate limiting to prevent abuse
    const ip = getClientIp(request);
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

    const emailHtml = renderVoucherEmailHtml(delivery);
    const result = await sendVoucherEmailMessage({
      delivery,
      to: delivery.recipientEmail,
      subject: voucherGiftSubject(delivery),
      html: emailHtml,
      idempotencyKey: getEmailIdempotencyKey(delivery, emailHtml),
    });

    if (!result.ok) {
      return NextResponse.json(
        { error: result.reason === "pdf" ? "Failed to generate voucher PDF" : "Failed to send email" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, messageId: result.messageId });
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
