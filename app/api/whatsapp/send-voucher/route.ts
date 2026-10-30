import { NextRequest, NextResponse } from "next/server";
import { generateWhatsAppUrl, WhatsAppVoucherData } from "@/lib/utils/whatsapp";
import { getAuthorizedVoucherDelivery } from "@/lib/payment/public-voucher-delivery";
import { createRateLimiter, getClientIp } from "@/lib/rate-limit";

const checkRateLimit = createRateLimiter({ limit: 10, windowMs: 60000 });

/**
 * Request body for sending voucher via WhatsApp
 */
interface SendWhatsAppRequest {
  orderId: string;
  token: string;
  orderItemId?: string;
}

/**
 * Response from WhatsApp voucher endpoint
 */
interface SendWhatsAppResponse {
  success: boolean;
  whatsappUrl?: string;
  error?: string;
}

/**
 * Validates the request body for required fields
 */
function validateRequest(body: Partial<SendWhatsAppRequest>): string | null {
  const requiredFields: (keyof SendWhatsAppRequest)[] = [
    "orderId",
    "token",
  ];

  for (const field of requiredFields) {
    if (!body[field]) {
      return `Missing required field: ${field}`;
    }
  }

  return null;
}

/**
 * POST /api/whatsapp/send-voucher
 *
 * Generates a WhatsApp Web URL for sending a voucher message.
 * The client can open this URL to initiate a WhatsApp conversation
 * with the pre-filled voucher message.
 */
export async function POST(
  request: NextRequest
): Promise<NextResponse<SendWhatsAppResponse>> {
  try {
    // Rate limiting to prevent abuse
    const ip = getClientIp(request);
    if (!checkRateLimit(ip)) {
      return NextResponse.json(
        { success: false, error: "Too many requests. Please try again later." },
        { status: 429 }
      );
    }

    const body: Partial<SendWhatsAppRequest> = await request.json();

    // Validate request body
    const validationError = validateRequest(body);
    if (validationError) {
      return NextResponse.json(
        { success: false, error: validationError },
        { status: 400 }
      );
    }

    const { orderId, token, orderItemId } = body as SendWhatsAppRequest;

    const delivery = await getAuthorizedVoucherDelivery(orderId, token, orderItemId);
    if (!delivery || !delivery.recipientPhone) {
      return NextResponse.json(
        { success: false, error: "Voucher tidak valid atau nomor tujuan tidak tersedia." },
        { status: 400 }
      );
    }

    // Construct verification URL
    const baseUrl =
      process.env.NEXT_PUBLIC_APP_URL || "https://kalanara-spa.vercel.app";
    const verifyUrl = `${baseUrl}/verify?code=${encodeURIComponent(delivery.voucherCode)}`;

    // Prepare voucher data for WhatsApp message generation
    const voucherData: WhatsAppVoucherData = {
      recipientPhone: delivery.recipientPhone,
      recipientName: delivery.recipientName,
      senderName: delivery.senderName,
      senderMessage: delivery.senderMessage || undefined,
      voucherCode: delivery.voucherCode,
      serviceName: delivery.serviceName,
      serviceDuration: delivery.serviceDuration,
      amount: delivery.amount,
      expiryDate: delivery.expiryDate,
      verifyUrl,
    };

    // Generate WhatsApp URL
    const whatsappUrl = generateWhatsAppUrl(voucherData);

    return NextResponse.json({
      success: true,
      whatsappUrl,
    });
  } catch (error) {
    console.error("WhatsApp API error:", error);

    // Handle JSON parse errors
    if (error instanceof SyntaxError) {
      return NextResponse.json(
        { success: false, error: "Invalid JSON in request body" },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
