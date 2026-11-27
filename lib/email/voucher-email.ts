import "server-only";

import { createHash } from "node:crypto";
import { Resend } from "resend";
import { APP_CONFIG } from "@/lib/constants";
import { generateVoucherPDF } from "@/lib/pdf";
import type { AuthorizedVoucherDelivery } from "@/lib/payment/public-voucher-delivery";
import {
  buildVoucherPdfUrl,
  getAppUrl,
  toVoucherPdfBytes,
  voucherPdfFilename,
} from "@/lib/payment/voucher-pdf-link";

export type VoucherEmailContent = Pick<
  AuthorizedVoucherDelivery,
  | "orderId"
  | "voucherCode"
  | "recipientEmail"
  | "recipientName"
  | "senderName"
  | "senderMessage"
  | "serviceName"
  | "serviceDuration"
  | "amount"
  | "expiryDate"
>;

let resendClient: Resend | null = null;

function getResend(): Resend {
  resendClient ??= new Resend(process.env.RESEND_API_KEY);
  return resendClient;
}

export function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function sanitizeHeaderValue(value: string): string {
  return value.replace(/[\r\n]+/g, " ").trim();
}

export interface VoucherPdfAttachment {
  filename: string;
  content: string;
  contentType: "application/pdf";
}

export async function createVoucherPdfAttachment(
  delivery: VoucherEmailContent
): Promise<VoucherPdfAttachment> {
  const blob = await generateVoucherPDF({
    code: delivery.voucherCode,
    serviceName: delivery.serviceName,
    recipientName: delivery.recipientName,
    senderName: delivery.senderName,
    senderMessage: delivery.senderMessage || undefined,
    expiryDate: delivery.expiryDate,
  });
  const bytes = await toVoucherPdfBytes(blob);

  return {
    filename: voucherPdfFilename(delivery.voucherCode),
    content: bytes.toString("base64"),
    contentType: "application/pdf",
  };
}

// Resend rejects a reused key whose payload differs (409) for 24 hours, so the
// key covers the rendered HTML: a template change, a new app URL or a new
// download-link secret gives a new key. The PDF bytes are left out because
// they are not deterministic.
export function getEmailIdempotencyKey(
  delivery: VoucherEmailContent,
  emailHtml: string,
  channel: "EMAIL" | "EMAIL_BUYER_COPY" = "EMAIL"
): string {
  const deliveryIdentity = JSON.stringify({
    channel,
    attachment: "voucher-pdf-v1",
    html: createHash("sha256").update(emailHtml).digest("hex"),
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

export function voucherGiftSubject(delivery: Pick<VoucherEmailContent, "senderName">): string {
  return `🎁 ${sanitizeHeaderValue(delivery.senderName)} sent you a gift from Kalanara Spa!`;
}

export type VoucherEmailVariant = "gift" | "buyer_copy";

// Subject for the buyer's copy of a voucher bought for someone else.
export function voucherBuyerCopySubject(
  delivery: Pick<VoucherEmailContent, "recipientName">
): string {
  return `Your copy: Kalanara Spa voucher for ${sanitizeHeaderValue(delivery.recipientName)}`;
}

export function renderVoucherEmailHtml(
  delivery: VoucherEmailContent,
  options: { variant?: VoucherEmailVariant; recipientEmail?: string | null } = {}
): string {
  const variant = options.variant ?? "gift";
  const recipientName = escapeHtml(delivery.recipientName);
  const senderName = escapeHtml(delivery.senderName);
  const senderMessage = delivery.senderMessage ? escapeHtml(delivery.senderMessage) : null;
  const voucherCode = escapeHtml(delivery.voucherCode);
  const serviceName = escapeHtml(delivery.serviceName);

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

  const appUrl = getAppUrl();
  const emailAsset = (fileName: string) => `${appUrl}/email/${fileName}`;
  // The download link is an extra next to the attached PDF: without the
  // link secret the email still goes out, with no download button.
  let pdfDownloadUrl: string | null = null;
  try {
    pdfDownloadUrl = escapeHtml(buildVoucherPdfUrl(delivery.voucherCode));
  } catch (linkError) {
    console.warn("Voucher PDF download link disabled:", linkError);
  }
  const fontStack = "'Outfit', 'Avenir Next', Avenir, 'Helvetica Neue', Arial, sans-serif";

  const buyerCopy = variant === "buyer_copy";
  const stripLabel = buyerCopy ? "Your copy" : "A gift for you";
  const heading = buyerCopy
    ? "A copy of the voucher you gave"
    : "You&rsquo;ve got a treatment gift voucher";
  const greeting = buyerCopy
    ? `Hi ${senderName}, here is a copy of the Kalanara Spa voucher you gave ${recipientName}. They book with the code below. If they can&rsquo;t find their email, you can forward this one.`
    : `Dear ${recipientName}, ${senderName} has gifted you a luxurious spa experience at Kalanara Spa. Your treatment is waiting for you.`;

  const emailHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Your Kalanara Spa Gift Voucher</title>
  <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600&display=swap" rel="stylesheet">
</head>
<body style="margin: 0; padding: 0; background-color: #fbfbfb; font-family: ${fontStack};">
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #fbfbfb;">
    <tr>
      <td style="padding: 40px 20px;">
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="600" style="margin: 0 auto; background-color: #ffffff; font-family: ${fontStack};">

          <!-- Top strip -->
          <tr>
            <td style="background-color: #243a3e; height: 36px; text-align: center; color: #fde6a9; font-size: 11px; font-weight: 500; letter-spacing: 3px; text-transform: uppercase;">
              ${stripLabel}&nbsp;&nbsp;<span style="color: #e6bf6d;">&bull;</span>&nbsp;&nbsp;Harmony in every touch&nbsp;&nbsp;<span style="color: #e6bf6d;">&bull;</span>&nbsp;&nbsp;${stripLabel}
            </td>
          </tr>
${
  variant === "buyer_copy"
    ? `
          <!-- Buyer copy note -->
          <tr>
            <td style="padding: 20px 40px; background-color: #f4efe6; color: #243a3e; font-size: 15px; line-height: 1.5; text-align: center;">
              This is your copy. The same voucher was sent to <strong style="font-weight: 600;">${recipientName}</strong>${
                options.recipientEmail ? ` at ${escapeHtml(options.recipientEmail)}` : ""
              }. Keep it in case they need the code.
            </td>
          </tr>`
    : ""
}
          <!-- Hero -->
          <tr>
            <td style="padding: 40px 40px 48px; text-align: center;">
              <p style="margin: 0; color: #8e734a; font-size: 13px; font-weight: 500; letter-spacing: 3px; text-transform: uppercase;">For ${recipientName}</p>
              <h1 style="margin: 12px auto 0; max-width: 460px; color: #243a3e; font-size: 44px; font-weight: 300; line-height: 1.08; letter-spacing: -1px;">${heading}</h1>
              <img src="${emailAsset("voucher-hero.jpg")}" width="520" height="340" alt="Kalanara Spa" style="display: block; margin: 32px auto 0; width: 520px; max-width: 100%; height: auto; border: 0;">
              <p style="margin: 32px auto 0; max-width: 440px; color: #243a3e; font-size: 16px; line-height: 1.6;">
                ${greeting}
              </p>
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin: 28px auto 0;">
                <tr>
                  <td style="background-color: #243a3e; border-radius: 999px;">
                    <a href="${APP_CONFIG.social.whatsapp}" style="display: inline-block; padding: 0 28px; line-height: 48px; color: #fde6a9; font-size: 15px; font-weight: 500; text-decoration: none;"><img src="${emailAsset("icon-phone-gold-light.png")}" width="16" height="16" alt="" style="display: inline-block; margin-right: 8px; vertical-align: middle; border: 0;"><span style="vertical-align: middle;">Book your treatment</span></a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Treatment details -->
          <tr>
            <td style="background-color: #243a3e; padding: 44px 40px;">
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                <tr>
                  <td valign="top" style="padding-right: 32px;">
                    <p style="margin: 0; color: #fde6a9; font-size: 26px; font-weight: 300; line-height: 1.2;">Your treatment details</p>
                    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin-top: 20px;">
                      <tr>
                        <td colspan="2" style="padding: 12px 0; border-bottom: 1px solid rgba(253, 230, 169, 0.2);">
                          <p style="margin: 0; color: #e6bf6d; font-size: 12px; letter-spacing: 2px; text-transform: uppercase;">Treatment</p>
                          <p style="margin: 2px 0 0; color: #ffffff; font-size: 17px; font-weight: 500;">${serviceName}</p>
                        </td>
                      </tr>
                      <tr>
                        <td width="50%" style="padding: 12px 0; border-bottom: 1px solid rgba(253, 230, 169, 0.2);">
                          <p style="margin: 0; color: #e6bf6d; font-size: 12px; letter-spacing: 2px; text-transform: uppercase;">Duration</p>
                          <p style="margin: 2px 0 0; color: #ffffff; font-size: 17px; font-weight: 500;">${delivery.serviceDuration} mins</p>
                        </td>
                        <td width="50%" style="padding: 12px 0; border-bottom: 1px solid rgba(253, 230, 169, 0.2);">
                          <p style="margin: 0; color: #e6bf6d; font-size: 12px; letter-spacing: 2px; text-transform: uppercase;">Value</p>
                          <p style="margin: 2px 0 0; color: #ffffff; font-size: 17px; font-weight: 500;">${formattedAmount}</p>
                        </td>
                      </tr>
                      <tr>
                        <td colspan="2" style="padding: 12px 0;">
                          <p style="margin: 0; color: #e6bf6d; font-size: 12px; letter-spacing: 2px; text-transform: uppercase;">Valid until</p>
                          <p style="margin: 2px 0 0; color: #ffffff; font-size: 17px; font-weight: 500;">${formattedExpiry}</p>
                        </td>
                      </tr>
                    </table>
                  </td>
                  <td width="220" valign="top">
                    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="220" style="background-color: #fbfbfb; border: 2px solid #ffe2b6;">
                      <tr>
                        <td style="padding: 28px 12px; text-align: center;">
                          <img src="${emailAsset("icon-ticket-gold.png")}" width="28" height="28" alt="" style="display: block; margin: 0 auto; border: 0;">
                          <p style="margin: 10px 0 0; color: #8e734a; font-size: 11px; font-weight: 500; letter-spacing: 2px; text-transform: uppercase;">Your voucher code</p>
                          <p style="margin: 10px 0 0; color: #243a3e; font-size: 18px; font-weight: 600; line-height: 1.2; letter-spacing: 0.5px; white-space: nowrap;">${voucherCode}</p>
                        </td>
                      </tr>
                      <tr>
                        <td style="background-color: #e6bf6d; text-align: center;">
                          ${
                            pdfDownloadUrl
                              ? `<a href="${pdfDownloadUrl}" style="display: block; line-height: 44px; color: #243a3e; font-size: 12px; font-weight: 600; letter-spacing: 1.5px; text-transform: uppercase; text-decoration: none;"><img src="${emailAsset("icon-download-teal.png")}" width="16" height="16" alt="" style="display: inline-block; margin-right: 8px; vertical-align: middle; border: 0;"><span style="vertical-align: middle;">Download PDF</span></a>`
                              : `<p style="margin: 0; line-height: 44px; color: #243a3e; font-size: 12px; font-weight: 600; letter-spacing: 1.5px; text-transform: uppercase;">Show on arrival</p>`
                          }
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          ${
            senderMessage
              ? `
          <!-- Sender note -->
          <tr>
            <td style="padding: 48px 56px 40px;">
              <p style="margin: 0; color: #8e734a; font-size: 13px; font-weight: 500; letter-spacing: 3px; text-transform: uppercase;">A note from ${senderName}</p>
              <p style="margin: 12px 0 0; height: 40px; color: #e6bf6d; font-size: 64px; font-weight: 300; line-height: 1;">&ldquo;</p>
              <p style="margin: 4px 0 0; color: #243a3e; font-size: 26px; font-weight: 300; line-height: 1.35;">${senderMessage}</p>
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin-top: 24px;">
                <tr>
                  <td width="32" style="border-top: 1px solid #e6bf6d; font-size: 0; line-height: 0;">&nbsp;</td>
                  <td style="padding-left: 12px; color: #8e734a; font-size: 15px; font-weight: 500;">${senderName}</td>
                </tr>
              </table>
            </td>
          </tr>
          `
              : ""
          }

          <!-- How to redeem -->
          <tr>
            <td style="background-color: #fbfbfb; border-top: 1px solid #dbdbdb; padding: 44px 40px; text-align: center;">
              <p style="margin: 0; color: #243a3e; font-size: 13px; font-weight: 600; letter-spacing: 3px; text-transform: uppercase;">How to redeem</p>
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin-top: 28px;">
                <tr>
                  ${[
                    {
                      icon: "icon-phone-brown.png",
                      text: `Call us to book your appointment<br><strong style="font-weight: 500; white-space: nowrap;">${APP_CONFIG.contact.phone}</strong>`,
                    },
                    { icon: "icon-ticket-brown.png", text: "Present this voucher code when you arrive" },
                    { icon: "icon-sparkles-brown.png", text: "Enjoy your spa experience!" },
                  ]
                    .map(
                      (step) => `
                  <td width="33%" valign="top" style="padding: 0 10px; text-align: center;">
                    <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin: 0 auto;">
                      <tr>
                        <td width="50" height="50" style="border: 1px solid #e6bf6d; border-radius: 26px; text-align: center;">
                          <img src="${emailAsset(step.icon)}" width="20" height="20" alt="" style="display: inline-block; vertical-align: middle; border: 0;">
                        </td>
                      </tr>
                    </table>
                    <p style="margin: 12px 0 0; color: #243a3e; font-size: 14px; line-height: 1.45;">${step.text}</p>
                  </td>`
                    )
                    .join("")}
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #243a3e; padding: 40px 40px 36px; text-align: center;">
              <img src="${appUrl}/logo-kalanara-light.png" width="156" height="40" alt="Kalanara" style="display: block; margin: 0 auto; border: 0;">
              <div style="margin-top: 24px; height: 1px; background-color: rgba(253, 230, 169, 0.2); line-height: 1px; font-size: 0;">&nbsp;</div>
              <p style="margin: 24px 0 0; color: #fde6a9; font-size: 13px; font-weight: 600; letter-spacing: 3px; text-transform: uppercase;">Kalanara Spa</p>
              <p style="margin: 8px 0 0; color: #ffe2b6; font-size: 13px;">${APP_CONFIG.contact.phone} &middot; ${APP_CONFIG.contact.email}</p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `;

  return emailHtml;
}

export type VoucherEmailSendResult =
  | { ok: true; messageId: string | null }
  | { ok: false; reason: "pdf" | "provider" | "network"; message: string };

// Sends one voucher email. The caller picks the address and the idempotency
// key: the order flow keys on the rendered content, an admin resend keys on
// its own audit row so each approved resend really goes out.
export async function sendVoucherEmailMessage(input: {
  delivery: VoucherEmailContent;
  to: string;
  subject: string;
  html: string;
  idempotencyKey: string;
}): Promise<VoucherEmailSendResult> {
  let pdfAttachment: VoucherPdfAttachment;
  try {
    pdfAttachment = await createVoucherPdfAttachment(input.delivery);
  } catch (pdfError) {
    console.error("Failed to generate voucher PDF:", pdfError);
    return { ok: false, reason: "pdf", message: "Failed to generate voucher PDF" };
  }

  let response: Awaited<ReturnType<ReturnType<typeof getResend>["emails"]["send"]>>;
  try {
    response = await getResend().emails.send(
      {
        from: "Kalanara Spa <noreply@voucher.kalanaraspa.com>",
        to: [input.to],
        subject: input.subject,
        html: input.html,
        attachments: [pdfAttachment],
      },
      { idempotencyKey: input.idempotencyKey }
    );
  } catch (sendError) {
    console.error("Email provider unreachable:", sendError);
    return { ok: false, reason: "network", message: "Email provider unreachable" };
  }
  const { data, error } = response;

  if (error) {
    console.error("Failed to send email:", error);
    // The SDK reports a failed fetch as application_error: the email may or
    // may not have gone out, which is not the same as a rejected address.
    const transport = (error as { name?: unknown }).name === "application_error";
    return {
      ok: false,
      reason: transport ? "network" : "provider",
      message: typeof error.message === "string" ? error.message : "Failed to send email",
    };
  }

  return { ok: true, messageId: data?.id ?? null };
}
