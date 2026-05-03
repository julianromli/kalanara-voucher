import { NextRequest, NextResponse } from "next/server";
import {
  createPendingOrder,
  createPendingOrderItems,
  markOrderFailedFromGateway,
  updateOrderGatewayData,
} from "@/lib/actions/orders";
import {
  allocateDiscountAcrossItems,
  createPendingDiscountRedemption,
  markDiscountRedemptionVoid,
  normalizeCustomerPhone,
  validateDiscountForCheckout,
} from "@/lib/discounts/service";
import { getServiceById } from "@/lib/actions/services";
import {
  createScalevOrder,
  createScalevPaymentIntent,
  getScalevCheckoutAvailability,
} from "@/lib/scalev/client";
import { getScalevConfig } from "@/lib/scalev/config";
import { ensureScalevServiceMapping } from "@/lib/scalev/catalog-sync";
import { buildScalevPublicOrderUrl } from "@/lib/scalev/urls";
import {
  SCALEV_PAYMENT_METHODS,
  SCALEV_VA_BANK_CODES,
  type ScalevCheckoutLineItem,
  type ScalevCreatePaymentErrorCode,
  type ScalevCreatePaymentResponse,
  type ScalevPaymentMethod,
  type ScalevVABankCode,
} from "@/lib/scalev/types";
import { DeliveryMethod, SendTo } from "@/lib/types";

interface ValidatedCheckoutLineItem extends ScalevCheckoutLineItem {
  customerName: string;
  customerEmail: string;
  customerPhone: string;
}

interface ValidatedCheckoutRequest {
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  discountCode?: string;
  paymentMethod: ScalevPaymentMethod;
  subPaymentMethod?: ScalevVABankCode;
  lineItems: ValidatedCheckoutLineItem[];
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

function isDeliveryMethod(value: string): value is DeliveryMethod {
  return Object.values(DeliveryMethod).includes(value as DeliveryMethod);
}

function isSendTo(value: string): value is SendTo {
  return Object.values(SendTo).includes(value as SendTo);
}

function buildLegacyLineItem(
  data: Record<string, unknown>,
  customer: Pick<ValidatedCheckoutRequest, "customerName" | "customerEmail" | "customerPhone">
): ValidatedCheckoutLineItem | null {
  const serviceId = getOptionalString(data.serviceId);
  const recipientName = getOptionalString(data.recipientName);
  const deliveryMethodValue = getOptionalString(data.deliveryMethod);
  const sendToValue = getOptionalString(data.sendTo);

  if (
    !serviceId ||
    !recipientName ||
    !deliveryMethodValue ||
    !sendToValue ||
    !isDeliveryMethod(deliveryMethodValue) ||
    !isSendTo(sendToValue)
  ) {
    return null;
  }

  return {
    ...customer,
    serviceId,
    recipientName,
    recipientEmail: getOptionalString(data.recipientEmail),
    recipientPhone: getOptionalString(data.recipientPhone),
    senderMessage: getOptionalString(data.senderMessage),
    deliveryMethod: deliveryMethodValue,
    sendTo: sendToValue,
  };
}

function normalizeLineItem(
  value: unknown,
  customer: Pick<ValidatedCheckoutRequest, "customerName" | "customerEmail" | "customerPhone">
): ValidatedCheckoutLineItem | null {
  if (typeof value !== "object" || value === null) {
    return null;
  }

  const data = value as Record<string, unknown>;
  const serviceId = getOptionalString(data.serviceId);
  const recipientName = getOptionalString(data.recipientName);
  const deliveryMethodValue = getOptionalString(data.deliveryMethod);
  const sendToValue = getOptionalString(data.sendTo);

  if (
    !serviceId ||
    !recipientName ||
    !deliveryMethodValue ||
    !sendToValue ||
    !isDeliveryMethod(deliveryMethodValue) ||
    !isSendTo(sendToValue)
  ) {
    return null;
  }

  return {
    ...customer,
    serviceId,
    recipientName,
    recipientEmail: getOptionalString(data.recipientEmail),
    recipientPhone: getOptionalString(data.recipientPhone),
    senderMessage: getOptionalString(data.senderMessage),
    deliveryMethod: deliveryMethodValue,
    sendTo: sendToValue,
  };
}

function hasRequiredDeliveryTarget(lineItem: ValidatedCheckoutLineItem) {
  const requiresRecipientPhone =
    lineItem.sendTo === SendTo.RECIPIENT &&
    (lineItem.deliveryMethod === DeliveryMethod.WHATSAPP ||
      lineItem.deliveryMethod === DeliveryMethod.BOTH);
  const requiresRecipientEmail =
    lineItem.sendTo === SendTo.RECIPIENT &&
    (lineItem.deliveryMethod === DeliveryMethod.EMAIL ||
      lineItem.deliveryMethod === DeliveryMethod.BOTH);

  return (
    (!requiresRecipientPhone || Boolean(lineItem.recipientPhone)) &&
    (!requiresRecipientEmail || Boolean(lineItem.recipientEmail))
  );
}

function validateRequest(body: unknown): ValidatedCheckoutRequest | null {
  if (typeof body !== "object" || body === null) {
    return null;
  }

  const data = body as Record<string, unknown>;
  const customerName = getOptionalString(data.customerName);
  const customerEmail = getOptionalString(data.customerEmail);
  const customerPhone = getOptionalString(data.customerPhone);
  const paymentMethod =
    typeof data.paymentMethod === "string" ? data.paymentMethod : "";

  if (!customerName || !customerEmail || !customerPhone || !isPaymentMethod(paymentMethod)) {
    return null;
  }

  const customer = {
    customerName,
    customerEmail,
    customerPhone: normalizeCustomerPhone(customerPhone),
  };

  const lineItems = Array.isArray(data.lineItems)
    ? data.lineItems
        .map((item) => normalizeLineItem(item, customer))
        .filter((item): item is ValidatedCheckoutLineItem => Boolean(item))
    : [];
  const legacyLineItem = lineItems.length === 0 ? buildLegacyLineItem(data, customer) : null;
  const normalizedLineItems =
    lineItems.length > 0 ? lineItems : legacyLineItem ? [legacyLineItem] : [];

  if (
    normalizedLineItems.length === 0 ||
    normalizedLineItems.some((item) => !hasRequiredDeliveryTarget(item))
  ) {
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
    ...customer,
    lineItems: normalizedLineItems.map((item) => ({
      ...item,
      recipientPhone: item.recipientPhone
        ? normalizeCustomerPhone(item.recipientPhone)
        : undefined,
    })),
    discountCode: getOptionalString(data.discountCode),
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

function errorResponse(
  error: string,
  errorCode: ScalevCreatePaymentErrorCode,
  status: number
): NextResponse<ScalevCreatePaymentResponse> {
  return NextResponse.json({ success: false, error, errorCode }, { status });
}

export async function POST(
  request: NextRequest
): Promise<NextResponse<ScalevCreatePaymentResponse>> {
  try {
    const body = await request.json().catch(() => null);
    const validatedData = validateRequest(body);

    if (!validatedData) {
      return errorResponse("Data checkout tidak valid.", "INVALID_CHECKOUT_DATA", 400);
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
      return errorResponse(
        "Metode pembayaran tidak tersedia.",
        "PAYMENT_METHOD_UNAVAILABLE",
        400
      );
    }

    const serviceRows = await Promise.all(
      validatedData.lineItems.map((item) => getServiceById(item.serviceId))
    );
    if (serviceRows.some((service) => !service || !service.is_active)) {
      return errorResponse("Layanan tidak tersedia.", "SERVICE_UNAVAILABLE", 404);
    }

    const services = serviceRows.map((service) => {
      if (!service) {
        throw new Error("Unexpected missing service after availability check");
      }
      return service;
    });
    const subtotalAmount = services.reduce((sum, service) => sum + service.price, 0);
    const discountValidation = validatedData.discountCode
      ? await validateDiscountForCheckout({
          discountCode: validatedData.discountCode,
          subtotalAmount,
          customerEmail: validatedData.customerEmail,
          customerPhone: validatedData.customerPhone,
        })
      : null;

    if (discountValidation && !discountValidation.valid) {
      return errorResponse(
        discountValidation.message,
        "DISCOUNT_CODE_INVALID",
        400
      );
    }

    const discountQuote =
      discountValidation && discountValidation.valid
        ? discountValidation.quote
        : null;
    const totalAmount = discountQuote?.totalAmount ?? subtotalAmount;
    const itemDiscounts = allocateDiscountAcrossItems(
      services.map((service) => service.price),
      discountQuote?.discountAmount ?? 0
    );
    const firstLine = validatedData.lineItems[0];
    const isSingleLine = validatedData.lineItems.length === 1;

    const order = await createPendingOrder({
      service_id: isSingleLine ? services[0].id : null,
      customer_email: validatedData.customerEmail,
      customer_name: validatedData.customerName,
      customer_phone: validatedData.customerPhone,
      recipient_name: isSingleLine ? firstLine.recipientName : null,
      recipient_email: isSingleLine ? firstLine.recipientEmail || null : null,
      recipient_phone: isSingleLine ? firstLine.recipientPhone || null : null,
      sender_message: isSingleLine ? firstLine.senderMessage || null : null,
      delivery_method: isSingleLine ? firstLine.deliveryMethod : null,
      send_to: isSingleLine ? firstLine.sendTo : null,
      subtotal_amount: subtotalAmount,
      discount_code_id: discountQuote?.discountCodeId ?? null,
      discount_code: discountQuote?.code ?? null,
      discount_type_snapshot: discountQuote?.discountType ?? null,
      discount_value_snapshot: discountQuote?.discountValue ?? null,
      discount_amount: discountQuote?.discountAmount ?? 0,
      total_amount: totalAmount,
      payment_method: validatedData.paymentMethod,
      sub_payment_method: validatedData.subPaymentMethod,
    });

    if (!order?.payment_order_id) {
      console.error("[Scalev] Local order insert returned no order");
      return errorResponse(
        "Pesanan belum bisa dibuat. Silakan coba lagi.",
        "LOCAL_ORDER_FAILED",
        500
      );
    }

    const mappings = await Promise.all(
      services.map((service) => ensureScalevServiceMapping(service))
    );

    const orderItems = await createPendingOrderItems(
      validatedData.lineItems.map((item, index) => ({
        order_id: order.id,
        service_id: services[index].id,
        original_unit_price: services[index].price,
        discount_amount: itemDiscounts[index] ?? 0,
        final_unit_price: services[index].price - (itemDiscounts[index] ?? 0),
        unit_price: services[index].price - (itemDiscounts[index] ?? 0),
        recipient_name: item.recipientName,
        recipient_email: item.recipientEmail || null,
        recipient_phone: item.recipientPhone || null,
        sender_message: item.senderMessage || null,
        delivery_method: item.deliveryMethod,
        send_to: item.sendTo,
        sort_order: index,
      }))
    );

    if (!orderItems || orderItems.length !== validatedData.lineItems.length) {
      await markOrderFailedFromGateway(order.id, {
        paymentProvider: "scalev",
        scalevPaymentMethod: validatedData.paymentMethod,
        scalevSubPaymentMethod: validatedData.subPaymentMethod || null,
        scalevStoreUniqueId: getScalevConfig().storeUniqueId,
      });
      return errorResponse(
        "Pesanan belum bisa dibuat. Silakan coba lagi.",
        "LOCAL_ORDER_FAILED",
        500
      );
    }

    const discountRedemption = discountQuote
      ? await createPendingDiscountRedemption({
          discountCodeId: discountQuote.discountCodeId,
          orderId: order.id,
          customerEmail: validatedData.customerEmail,
          customerPhone: validatedData.customerPhone,
          discountType: discountQuote.discountType,
          discountValue: discountQuote.discountValue,
          subtotalAmount: discountQuote.subtotalAmount,
          discountAmount: discountQuote.discountAmount,
          totalAmount: discountQuote.totalAmount,
        })
      : null;

    if (discountQuote && !discountRedemption) {
      await markOrderFailedFromGateway(order.id, {
        paymentProvider: "scalev",
        scalevPaymentMethod: validatedData.paymentMethod,
        scalevSubPaymentMethod: validatedData.subPaymentMethod || null,
        scalevStoreUniqueId: getScalevConfig().storeUniqueId,
      });
      return errorResponse(
        "Pesanan belum bisa dibuat. Silakan coba lagi.",
        "LOCAL_ORDER_FAILED",
        500
      );
    }

    try {
      const scalevOrder = await createScalevOrder({
        customer_name: validatedData.customerName,
        customer_email: validatedData.customerEmail,
        customer_phone: validatedData.customerPhone,
        store_unique_id: getScalevConfig().storeUniqueId,
        ordervariants: mappings.map((mapping) => ({
          variant_unique_id: mapping.primaryVariant.unique_id,
          quantity: 1,
        })),
        productDiscount: discountQuote?.discountAmount,
        paymentMethod: validatedData.paymentMethod,
        subPaymentMethod: validatedData.subPaymentMethod,
        metadata: {
          local_order_id: order.id,
          payment_order_id: order.payment_order_id,
          item_count: validatedData.lineItems.length,
          subtotal_amount: subtotalAmount,
          discount_code: discountQuote?.code ?? null,
          discount_amount: discountQuote?.discountAmount ?? 0,
          total_amount: totalAmount,
        },
        notes: `Kalanara voucher x${validatedData.lineItems.length} - ${order.payment_order_id}`,
      });

      let paymentIntent = null;
      if (scalevOrder.id) {
        paymentIntent = await createScalevPaymentIntent(scalevOrder.id).catch((error) => {
          console.warn("[Scalev] create payment intent failed; using order link fallback:", error);
          return null;
        });
      }

      const paymentLink = extractPaymentLink(scalevOrder, paymentIntent);
      const pgReferenceId =
        paymentIntent?.pg_reference_id ||
        paymentIntent?.reference_id ||
        scalevOrder.pg_reference_id ||
        null;
      const gatewayUpdate = {
        paymentProvider: "scalev" as const,
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
      };

      const gatewayDataPersisted = await updateOrderGatewayData(order.id, gatewayUpdate);
      if (!gatewayDataPersisted) {
        console.error("[Scalev] Failed to persist gateway metadata for local order", {
          orderId: order.id,
          paymentOrderId: order.payment_order_id,
          scalevOrderPk: scalevOrder.id,
          scalevPgReferenceId: pgReferenceId,
        });
        await markOrderFailedFromGateway(order.id, {
          paymentProvider: "scalev",
          transactionId: pgReferenceId,
          paymentType: scalevOrder.payment_method || validatedData.paymentMethod,
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
        });
        if (discountQuote) {
          await markDiscountRedemptionVoid(order.id);
        }
        return errorResponse(
          "Pesanan belum bisa disiapkan sepenuhnya. Silakan coba lagi.",
          "LOCAL_ORDER_FAILED",
          500
        );
      }

      if (!paymentLink) {
        if (discountQuote) {
          await markDiscountRedemptionVoid(order.id);
        }
        return errorResponse(
          "Payment link dari Scalev belum tersedia. Silakan coba beberapa saat lagi.",
          "PAYMENT_LINK_MISSING",
          502
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
      if (discountQuote) {
        await markDiscountRedemptionVoid(order.id);
      }

      console.error("[Scalev] create-payment failed:", error);
      return errorResponse(
        discountQuote
          ? "Pembayaran dengan kode diskon belum bisa diproses saat ini. Silakan coba lagi."
          : "Gagal membuat pembayaran Scalev. Silakan coba lagi.",
        discountQuote ? "DISCOUNT_GATEWAY_REJECTED" : "SCALEV_PAYMENT_FAILED",
        502
      );
    }
  } catch (error) {
    console.error("[Scalev] Unexpected create-payment error:", error);
    return errorResponse(
      "Terjadi kendala saat menyiapkan pembayaran. Silakan coba lagi.",
      "INTERNAL_ERROR",
      500
    );
  }
}
