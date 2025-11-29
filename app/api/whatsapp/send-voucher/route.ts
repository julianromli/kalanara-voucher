import { NextRequest, NextResponse } from "next/server";
import { generateWhatsAppUrl, WhatsAppVoucherData } from "@/lib/utils/whatsapp";

/**
 * Request body for sending voucher via WhatsApp
 */
interface SendWhatsAppRequest {
  recipientPhone: string;
  recipientName: string;
  senderName: string;
  senderMessage?: string;
  voucherCode: string;
  serviceName: string;
  serviceDuration: number;
  amount: number;
  expiryDate: string;
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
    "recipientPhone",
    "recipientName",
    "senderName",
    "voucherCode",
    "serviceName",
    "serviceDuration",
    "amount",
    "expiryDate",
  ];

  for (const field of requiredFields) {
    if (!body[field]) {
      return `Missing required field: ${field}`;
    }
  }

  // Validate phone number format (basic check)
  const phone = body.recipientPhone!;
  if (!/^[\d\s+()-]+$/.test(phone) || phone.replace(/\D/g, "").length < 8) {
    return "Invalid phone number format";
  }

  // Validate amount is positive
  if (body.amount! <= 0) {
    return "Amount must be a positive number";
  }

  // Validate duration is positive
  if (body.serviceDuration! <= 0) {
    return "Service duration must be a positive number";
  }

  // Validate expiry date is a valid date
  const expiryDate = new Date(body.expiryDate!);
  if (isNaN(expiryDate.getTime())) {
    return "Invalid expiry date format";
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
    const body: Partial<SendWhatsAppRequest> = await request.json();

    // Validate request body
    const validationError = validateRequest(body);
    if (validationError) {
      return NextResponse.json(
        { success: false, error: validationError },
        { status: 400 }
      );
    }

    const {
      recipientPhone,
      recipientName,
      senderName,
      senderMessage,
      voucherCode,
      serviceName,
      serviceDuration,
      amount,
      expiryDate,
    } = body as SendWhatsAppRequest;

    // Construct verification URL
    const baseUrl =
      process.env.NEXT_PUBLIC_APP_URL || "https://kalanara-spa.vercel.app";
    const verifyUrl = `${baseUrl}/verify?code=${encodeURIComponent(voucherCode)}`;

    // Prepare voucher data for WhatsApp message generation
    const voucherData: WhatsAppVoucherData = {
      recipientPhone,
      recipientName,
      senderName,
      senderMessage,
      voucherCode,
      serviceName,
      serviceDuration,
      amount,
      expiryDate,
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
