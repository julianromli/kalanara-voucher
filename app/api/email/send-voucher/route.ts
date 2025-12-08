import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { getVoucherByCode } from "@/lib/actions/vouchers";

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
  recipientEmail: string;
  recipientName: string;
  senderName: string;
  senderMessage?: string;
  voucherCode: string;
  serviceName: string;
  serviceDuration: number;
  amount: number;
  expiryDate: string;
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

    const body: VoucherEmailRequest = await request.json();

    const {
      recipientEmail,
      recipientName,
      senderName,
      senderMessage,
      voucherCode,
      serviceName,
      serviceDuration,
      amount,
      expiryDate,
    } = body;

    // Validate voucher exists in database (prevents arbitrary email sending)
    const voucher = await getVoucherByCode(voucherCode);
    if (!voucher) {
      return NextResponse.json(
        { error: "Invalid voucher code" },
        { status: 400 }
      );
    }

    const formattedAmount = new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      minimumFractionDigits: 0,
    }).format(amount);

    const formattedExpiry = new Date(expiryDate).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });

    const emailHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Your Kalanara Spa Gift Voucher</title>
</head>
<body style="margin: 0; padding: 0; background-color: #faf8f5; font-family: 'Helvetica Neue', Arial, sans-serif;">
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #faf8f5;">
    <tr>
      <td style="padding: 40px 20px;">
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="600" style="margin: 0 auto; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 20px rgba(93, 112, 72, 0.08);">
          
          <!-- Header -->
          <tr>
            <td style="background-color: #5d7048; padding: 40px; text-align: center;">
              <h1 style="margin: 0; color: #faf8f5; font-size: 28px; font-weight: 600; letter-spacing: 2px;">KALANARA</h1>
              <p style="margin: 8px 0 0; color: #d2d9c8; font-size: 14px;">Harmony in Every Touch</p>
            </td>
          </tr>
          
          <!-- Gift Message -->
          <tr>
            <td style="padding: 40px;">
              <p style="margin: 0 0 8px; color: #5d7048; font-size: 14px; text-transform: uppercase; letter-spacing: 1px;">A Special Gift For You</p>
              <h2 style="margin: 0 0 20px; color: #343f2c; font-size: 32px; font-weight: 400; font-family: 'Helvetica Neue', Arial, sans-serif;">Dear ${recipientName},</h2>
              <p style="margin: 0 0 24px; color: #5d4a3b; font-size: 16px; line-height: 1.6;">
                ${senderName} has gifted you a luxurious spa experience at Kalanara Spa.
              </p>
              ${
                senderMessage
                  ? `
              <div style="background-color: #f6f7f4; padding: 20px; border-radius: 12px; border-left: 4px solid #94a67a; margin-bottom: 24px;">
                <p style="margin: 0; color: #4a5a3b; font-style: italic; font-size: 15px;">"${senderMessage}"</p>
                <p style="margin: 12px 0 0; color: #778c5d; font-size: 13px;">— ${senderName}</p>
              </div>
              `
                  : ""
              }
            </td>
          </tr>
          
          <!-- Voucher Details -->
          <tr>
            <td style="padding: 0 40px 40px;">
              <div style="background: linear-gradient(135deg, #5d7048 0%, #778c5d 100%); padding: 32px; border-radius: 16px; text-align: center;">
                <p style="margin: 0 0 8px; color: #d2d9c8; font-size: 12px; text-transform: uppercase; letter-spacing: 2px;">Your Voucher Code</p>
                <p style="margin: 0 0 24px; color: #ffffff; font-size: 28px; font-weight: 700; font-family: 'Courier New', monospace; letter-spacing: 3px;">${voucherCode}</p>
                
                <div style="background-color: rgba(255,255,255,0.15); padding: 20px; border-radius: 12px;">
                  <p style="margin: 0 0 4px; color: #e8ebe3; font-size: 12px; text-transform: uppercase;">Treatment</p>
                  <p style="margin: 0 0 16px; color: #ffffff; font-size: 18px; font-weight: 500;">${serviceName}</p>
                  
                  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                    <tr>
                      <td style="text-align: center; padding: 8px;">
                        <p style="margin: 0; color: #d2d9c8; font-size: 11px; text-transform: uppercase;">Duration</p>
                        <p style="margin: 4px 0 0; color: #ffffff; font-size: 16px; font-weight: 500;">${serviceDuration} mins</p>
                      </td>
                      <td style="text-align: center; padding: 8px;">
                        <p style="margin: 0; color: #d2d9c8; font-size: 11px; text-transform: uppercase;">Value</p>
                        <p style="margin: 4px 0 0; color: #ffffff; font-size: 16px; font-weight: 500;">${formattedAmount}</p>
                      </td>
                    </tr>
                  </table>
                </div>
                
                <p style="margin: 20px 0 0; color: #b3c0a1; font-size: 13px;">Valid until ${formattedExpiry}</p>
              </div>
            </td>
          </tr>
          
          <!-- How to Redeem -->
          <tr>
            <td style="padding: 0 40px 40px;">
              <h3 style="margin: 0 0 16px; color: #343f2c; font-size: 18px;">How to Redeem</h3>
              <ol style="margin: 0; padding: 0 0 0 20px; color: #5d4a3b; font-size: 14px; line-height: 1.8;">
                <li>Call us at +62 361 123 4567 to book your appointment</li>
                <li>Present this voucher code when you arrive</li>
                <li>Enjoy your spa experience!</li>
              </ol>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="background-color: #f6f7f4; padding: 32px 40px; text-align: center;">
              <p style="margin: 0 0 8px; color: #343f2c; font-size: 16px; font-weight: 600;">KALANARA SPA</p>
              <p style="margin: 0 0 4px; color: #5d4a3b; font-size: 13px;">Jl. Raya Ubud No. 88, Ubud, Bali 80571</p>
              <p style="margin: 0; color: #5d4a3b; font-size: 13px;">+62 361 123 4567 | hello@kalanaraspa.com</p>
            </td>
          </tr>
          
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `;

    const { data, error } = await resend.emails.send({
      from: "Kalanara Spa <voucher@kalanaraspa.com>",
      to: [recipientEmail],
      subject: `🎁 ${senderName} sent you a gift from Kalanara Spa!`,
      html: emailHtml,
    });

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
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
