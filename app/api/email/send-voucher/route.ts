import { NextRequest, NextResponse } from "next/server";
import { listVoucherDeliveryChannels } from "@/lib/payment/voucherDeliveryOutbox";
import { createRateLimiter, getClientIp } from "@/lib/rate-limit";
import { getAuthorizedVoucherDelivery } from "@/lib/payment/public-voucher-delivery";
import {
  getEmailIdempotencyKey,
  renderVoucherEmailHtml,
  sendVoucherEmailMessage,
  voucherBuyerCopySubject,
  voucherGiftSubject,
} from "@/lib/email/voucher-email";
import { isValidEmailAddress, sameEmailAddress } from "@/lib/email-address";

const checkRateLimit = createRateLimiter({ limit: 10, windowMs: 60000 });

interface VoucherEmailRequest {
  orderId: string;
  token: string;
  orderItemId?: string;
  // "buyer" sends the buyer's copy of a voucher bought for someone else.
  audience?: "buyer";
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

    const { orderId, token, orderItemId, audience } = body;

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

    if (audience === "buyer") {
      // Only deliverVoucher decides who gets a copy: it reserves an
      // EMAIL_BUYER_COPY outbox row first. Without that row (orders emailed
      // before copies existed, vouchers bought for the buyer) nothing is sent,
      // even to a caller holding the order token.
      const reserved =
        delivery.sendTo === "RECIPIENT" &&
        (await listVoucherDeliveryChannels(delivery.voucherId)).includes("EMAIL_BUYER_COPY");
      if (!reserved) {
        return NextResponse.json(
          { error: "Salinan untuk pembeli tidak dijadwalkan untuk voucher ini." },
          { status: 409 }
        );
      }
      const buyerEmail = delivery.buyerEmail?.trim() ?? "";
      if (!buyerEmail || !isValidEmailAddress(buyerEmail)) {
        return NextResponse.json(
          { error: "Email pembeli tidak tersedia." },
          { status: 400 }
        );
      }
      if (sameEmailAddress(buyerEmail, delivery.recipientEmail)) {
        // The recipient address is the buyer's: the gift email already
        // reached them, so there is no copy to send.
        return NextResponse.json({ success: true, skipped: "same_address" });
      }

      const copyHtml = renderVoucherEmailHtml(delivery, {
        variant: "buyer_copy",
        recipientEmail: delivery.recipientEmail,
      });
      const copyResult = await sendVoucherEmailMessage({
        delivery,
        to: buyerEmail,
        subject: voucherBuyerCopySubject(delivery),
        html: copyHtml,
        idempotencyKey: getEmailIdempotencyKey(
          { ...delivery, recipientEmail: buyerEmail },
          copyHtml,
          "EMAIL_BUYER_COPY"
        ),
      });
      if (!copyResult.ok) {
        return NextResponse.json(
          {
            error:
              copyResult.reason === "pdf" ? "Failed to generate voucher PDF" : "Failed to send email",
          },
          { status: 500 }
        );
      }
      return NextResponse.json({ success: true, messageId: copyResult.messageId });
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
