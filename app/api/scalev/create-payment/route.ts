import { NextRequest, NextResponse } from "next/server";
import { createPendingOrder, markOrderFailedFromGateway, updateOrderGatewayData } from "@/lib/actions/orders";
import { getServiceById } from "@/lib/actions/services";
import { createScalevOrder, createScalevPaymentIntent, getScalevCheckoutAvailability } from "@/lib/scalev/client";
import { getScalevConfig } from "@/lib/scalev/config";
import { ensureScalevServiceMapping } from "@/lib/scalev/catalog-sync";
import { buildScalevPublicOrderUrl } from "@/lib/scalev/urls";
import {
  SCALEV_PAYMENT_METHODS,
  SCALEV_VA_BANK_CODES,
  type ScalevCheckoutRequest,
  type ScalevCreatePaymentResponse,
  type ScalevPaymentMethod,
  type ScalevVABankCode,
} from "@/lib/scalev/types";
import { DeliveryMethod, SendTo } from "@/lib/types";

function normalizeScalevPhoneNumber(phone: string) {
  const digits = phone.replace(/\D/g, "");

  if (digits.startsWith("0")) {
    return `62${digits.slice(1)}`;
  }

  if (digits.startsWith("62")) {
    return digits;
  }

  return digits;
}

function isPaymentMethod(value: string): value is ScalevPaymentMethod {
  return SCALEV_PAYMENT_METHODS.includes(value as ScalevPaymentMethod);
}

function isVABank(value: string): value is ScalevVABankCode {
  return SCALEV_VA_BANK_CODES.includes(value as ScalevVABankCode);
}

function getOptionalString(value: unknown) {
  if (typeof value !== "string") {
    return undefined;
  }

  const normalized = value.trim();
  return normalized ? normalized : undefined;
}

function validateRequest(body: unknown): ScalevCheckoutRequest | null {
  if (typeof body !== "object" || body === null) {
    return null;
  }

  const data = body as Record<string, unknown>;
  const serviceId = getOptionalString(data.serviceId);
  const customerName = getOptionalString(data.customerName);
  const customerEmail = getOptionalString(data.customerEmail);
  const customerPhone = getOptionalString(data.customerPhone);
  const recipientName = getOptionalString(data.recipientName);
  const deliveryMethodValue = getOptionalString(data.deliveryMethod);
  const sendToValue = getOptionalString(data.sendTo);
  const paymentMethod =
    typeof data.paymentMethod === "string" ? data.paymentMethod : "";

  if (
    !serviceId ||
    !customerName ||
    !customerEmail ||
    !customerPhone ||
    !recipientName ||
    !deliveryMethodValue ||
    !sendToValue ||
    !isPaymentMethod(paymentMethod)
  ) {
    return null;
  }

  if (
    !Object.values(DeliveryMethod).includes(deliveryMethodValue as DeliveryMethod) ||
    !Object.values(SendTo).includes(sendToValue as SendTo)
  ) {
    return null;
  }

  const deliveryMethod = deliveryMethodValue as DeliveryMethod;
  const sendTo = sendToValue as SendTo;
  const recipientPhone = getOptionalString(data.recipientPhone);
  const recipientEmail = getOptionalString(data.recipientEmail);
  const requiresRecipientPhone =
    sendTo === SendTo.RECIPIENT &&
    (deliveryMethod === DeliveryMethod.WHATSAPP ||
      deliveryMethod === DeliveryMethod.BOTH);
  const requiresRecipientEmail =
    sendTo === SendTo.RECIPIENT &&
    (deliveryMethod === DeliveryMethod.EMAIL || deliveryMethod === DeliveryMethod.BOTH);

  if ((requiresRecipientPhone && !recipientPhone) || (requiresRecipientEmail && !recipientEmail)) {
    return null;
  }

  const subPaymentMethodRaw =
    typeof data.subPaymentMethod === "string" ? data.subPaymentMethod : undefined;

  if (
    paymentMethod === "va" &&
    (!subPaymentMethodRaw || !isVABank(subPaymentMethodRaw))
  ) {
    return null;
  }

  return {
    serviceId,
    customerName,
    customerEmail,
    customerPhone: normalizeScalevPhoneNumber(customerPhone),
    recipientName,
    recipientEmail,
    recipientPhone: recipientPhone
      ? normalizeScalevPhoneNumber(recipientPhone)
      : undefined,
    senderMessage: getOptionalString(data.senderMessage),
    deliveryMethod,
    sendTo,
    paymentMethod,
    subPaymentMethod:
      paymentMethod === "va" && subPaymentMethodRaw
        ? (subPaymentMethodRaw as ScalevVABankCode)
        : undefined,
  };
}

function extractPaymentLink(
  createdOrder: {
    invoice_url?: string | null;
    payment_link?: string | null;
    secret_slug?: string | null;
  },
  intent: {
    payment_url?: string;
    invoice_url?: string;
  } | null
) {
  return (
    intent?.payment_url ||
    intent?.invoice_url ||
    createdOrder.invoice_url ||
    createdOrder.payment_link ||
    buildScalevPublicOrderUrl(createdOrder.secret_slug) ||
    null
  );
}

export async function POST(
  request: NextRequest
): Promise<NextResponse<ScalevCreatePaymentResponse>> {
  try {
    const body = await request.json().catch(() => null);
    const validatedData = validateRequest(body);

    if (!validatedData) {
      return NextResponse.json(
        { success: false, error: "Data checkout tidak valid." },
        { status: 400 }
      );
    }

    const service = await getServiceById(validatedData.serviceId);
    if (!service || !service.is_active) {
      return NextResponse.json(
        { success: false, error: "Layanan tidak tersedia." },
        { status: 404 }
      );
    }

    const availability = await getScalevCheckoutAvailability();
    const methodAllowed = availability.paymentMethods.includes(
      validatedData.paymentMethod
    );
    const subMethodAllowed =
      validatedData.paymentMethod !== "va" ||
      availability.subPaymentMethods.includes(
        validatedData.subPaymentMethod as ScalevVABankCode
      );

    if (!methodAllowed || !subMethodAllowed) {
      return NextResponse.json(
        { success: false, error: "Metode pembayaran tidak tersedia." },
        { status: 400 }
      );
    }

    const mapping = await ensureScalevServiceMapping(service);
    const order = await createPendingOrder({
      service_id: service.id,
      customer_email: validatedData.customerEmail,
      customer_name: validatedData.customerName,
      customer_phone: validatedData.customerPhone,
      recipient_name: validatedData.recipientName,
      recipient_email: validatedData.recipientEmail,
      recipient_phone: validatedData.recipientPhone || null,
      sender_message: validatedData.senderMessage,
      delivery_method: validatedData.deliveryMethod,
      send_to: validatedData.sendTo,
      total_amount: service.price,
      payment_method: validatedData.paymentMethod,
      sub_payment_method: validatedData.subPaymentMethod,
    });

    if (!order?.payment_order_id) {
      return NextResponse.json(
        { success: false, error: "Gagal membuat pesanan lokal." },
        { status: 500 }
      );
    }

    try {
      const scalevOrder = await createScalevOrder({
        customer_name: validatedData.customerName,
        customer_email: validatedData.customerEmail,
        customer_phone: validatedData.customerPhone,
        store_unique_id: getScalevConfig().storeUniqueId,
        ordervariants: [
          {
            variant_unique_id: mapping.primaryVariant.unique_id,
            quantity: 1,
          },
        ],
        paymentMethod: validatedData.paymentMethod,
        subPaymentMethod: validatedData.subPaymentMethod,
        metadata: {
          local_order_id: order.id,
          payment_order_id: order.payment_order_id,
          service_id: service.id,
          service_name: service.name,
        },
        notes: `Kalanara voucher ${service.name} - ${order.payment_order_id}`,
      });

      let paymentIntent = null;
      if (scalevOrder.id) {
        paymentIntent = await createScalevPaymentIntent(scalevOrder.id).catch(() => null);
      }

      const paymentLink = extractPaymentLink(scalevOrder, paymentIntent);
      const pgReferenceId =
        paymentIntent?.pg_reference_id ||
        paymentIntent?.reference_id ||
        scalevOrder.pg_reference_id ||
        null;

      await updateOrderGatewayData(order.id, {
        paymentProvider: "scalev",
        transactionId: pgReferenceId,
        paymentType: scalevOrder.payment_method || validatedData.paymentMethod,
        transactionTime: new Date().toISOString(),
        paymentLink,
        scalevOrderPk: scalevOrder.id,
        scalevOrderId: scalevOrder.order_id || null,
        scalevPgReferenceId: pgReferenceId,
        scalevPaymentMethod:
          scalevOrder.payment_method || validatedData.paymentMethod,
        scalevSubPaymentMethod:
          scalevOrder.sub_payment_method || validatedData.subPaymentMethod || null,
        scalevStoreUniqueId: getScalevConfig().storeUniqueId,
        scalevRawStatus: scalevOrder.status || null,
        scalevRawPaymentStatus: scalevOrder.payment_status || null,
        scalevLastCheckedAt: new Date().toISOString(),
      });

      if (!paymentLink) {
        return NextResponse.json(
          {
            success: false,
            error:
              "Payment link dari Scalev belum tersedia. Silakan coba beberapa saat lagi.",
          },
          { status: 502 }
        );
      }

      return NextResponse.json({
        success: true,
        paymentLink,
        orderId: scalevOrder.order_id || String(scalevOrder.id),
        paymentOrderId: order.payment_order_id,
        publicAccessToken: order.public_access_token,
        paymentMethod: validatedData.paymentMethod,
        subPaymentMethod: validatedData.subPaymentMethod,
      });
    } catch (error) {
      await markOrderFailedFromGateway(order.id, {
        paymentProvider: "scalev",
        scalevPaymentMethod: validatedData.paymentMethod,
        scalevSubPaymentMethod: validatedData.subPaymentMethod || null,
        scalevStoreUniqueId: getScalevConfig().storeUniqueId,
      });

      console.error("[Scalev] create-payment failed:", error);
      return NextResponse.json(
        { success: false, error: "Gagal membuat pembayaran Scalev." },
        { status: 502 }
      );
    }
  } catch (error) {
    console.error("[Scalev] Unexpected create-payment error:", error);
    return NextResponse.json(
      { success: false, error: "Terjadi kesalahan internal." },
      { status: 500 }
    );
  }
}
