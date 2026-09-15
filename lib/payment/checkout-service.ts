import "server-only";

import { getServiceById } from "@/lib/actions/services";
import {
  createPendingDiscountRedemption,
  markDiscountRedemptionVoid,
  validateDiscountForCheckout,
  type DiscountQuote,
} from "@/lib/discounts/service";
import {
  createPendingOrderForCheckout,
  createPendingOrderItemsForOrder,
  markOrderFailedFromGateway,
} from "@/lib/payment/order-writes";
import { createOrderStatusSession } from "@/lib/payment/order-status-sessions";
import { transitionOrderPaymentState } from "@/lib/payment/payment-state";
import {
  createScalevOrder,
  createScalevPaymentIntent,
  getScalevCheckoutAvailability,
} from "@/lib/scalev/client";
import { ensureScalevServiceMapping } from "@/lib/scalev/catalog-sync";
import { getScalevConfig } from "@/lib/scalev/config";
import type {
  ScalevCreatePaymentErrorCode,
  ScalevCreatePaymentResponse,
  ScalevVABankCode,
} from "@/lib/scalev/types";
import {
  buildScalevPublicOrderUrl,
  sanitizeScalevPublicUrl,
} from "@/lib/scalev/urls";
import {
  validateCheckoutRequest,
  type ValidatedCheckoutRequest,
} from "@/lib/payment/checkout-validation";

interface CheckoutFailure {
  success: false;
  body: ScalevCreatePaymentResponse;
  status: number;
}

interface CheckoutSuccess {
  success: true;
  body: ScalevCreatePaymentResponse;
  statusSession: {
    id: string;
    rawToken: string;
  };
}

export type CheckoutServiceResult = CheckoutFailure | CheckoutSuccess;

type OrderFailureDetails = NonNullable<
  Parameters<typeof markOrderFailedFromGateway>[1]
>;

interface CheckoutAttemptContext {
  order: {
    id: string;
    payment_order_id: string | null;
  } | null;
  discountReserved: boolean;
  completed: boolean;
  markOrderFailed: boolean;
  failureDetails: OrderFailureDetails;
}

function failure(
  error: string,
  errorCode: ScalevCreatePaymentErrorCode,
  status: number
): CheckoutFailure {
  return {
    success: false,
    body: { success: false, error, errorCode },
    status,
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
    sanitizeScalevPublicUrl(intent?.payment_url) ||
    sanitizeScalevPublicUrl(intent?.invoice_url) ||
    sanitizeScalevPublicUrl(createdOrder.invoice_url) ||
    sanitizeScalevPublicUrl(createdOrder.payment_link) ||
    buildScalevPublicOrderUrl(createdOrder.secret_slug) ||
    null
  );
}

async function markFailedOrder(
  orderId: string,
  details: OrderFailureDetails
): Promise<void> {
  try {
    const markedFailed = await markOrderFailedFromGateway(orderId, details);
    if (!markedFailed) {
      console.error("[Scalev] Local order could not be marked as failed", {
        orderId,
      });
    }
  } catch (error) {
    console.error("[Scalev] Failed to clean up local order", {
      orderId,
      error,
    });
  }
}

async function compensateFailedAttempt(
  context: CheckoutAttemptContext
): Promise<void> {
  if (!context.order || context.completed) {
    return;
  }

  if (context.markOrderFailed) {
    await markFailedOrder(context.order.id, context.failureDetails);
  }

  if (!context.discountReserved) {
    return;
  }

  try {
    const redemptionVoided = await markDiscountRedemptionVoid(context.order.id);
    if (!redemptionVoided) {
      console.error(
        "[Scalev] Failed to void pending discount redemption during cleanup",
        {
          orderId: context.order.id,
          paymentOrderId: context.order.payment_order_id,
        }
      );
    }
  } catch (error) {
    console.error("[Scalev] Discount cleanup failed", {
      orderId: context.order.id,
      paymentOrderId: context.order.payment_order_id,
      error,
    });
  }
}

async function runCheckoutAttempt(input: {
  checkout: ValidatedCheckoutRequest;
  services: NonNullable<Awaited<ReturnType<typeof getServiceById>>>[];
  mappings: Awaited<ReturnType<typeof ensureScalevServiceMapping>>[];
  discountQuote: DiscountQuote | null;
  subtotalAmount: number;
  totalAmount: number;
  storeUniqueId: string;
}): Promise<CheckoutServiceResult> {
  const {
    checkout,
    services,
    mappings,
    discountQuote,
    subtotalAmount,
    totalAmount,
    storeUniqueId,
  } = input;
  const baseFailureDetails: OrderFailureDetails = {
    paymentProvider: "scalev",
    scalevPaymentMethod: checkout.paymentMethod,
    scalevSubPaymentMethod: checkout.subPaymentMethod || null,
    scalevStoreUniqueId: storeUniqueId,
  };
  const context: CheckoutAttemptContext = {
    order: null,
    discountReserved: false,
    completed: false,
    markOrderFailed: false,
    failureDetails: baseFailureDetails,
  };

  try {
    const firstLine = checkout.lineItems[0];
    const isSingleLine = checkout.lineItems.length === 1;
    const order = await createPendingOrderForCheckout({
      service_id: isSingleLine ? services[0].id : null,
      customer_email: checkout.customerEmail,
      customer_name: checkout.customerName,
      customer_phone: checkout.customerPhone,
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
      payment_method: checkout.paymentMethod,
      sub_payment_method: checkout.subPaymentMethod,
    });

    context.order = order;
    if (!order?.payment_order_id) {
      console.error("[Scalev] Local order insert returned no order");
      context.markOrderFailed = Boolean(order?.id);
      return failure(
        "Pesanan belum bisa dibuat. Silakan coba lagi.",
        "LOCAL_ORDER_FAILED",
        500
      );
    }

    if (discountQuote) {
      try {
        const redemption = await createPendingDiscountRedemption({
          discountCodeId: discountQuote.discountCodeId,
          orderId: order.id,
          customerEmail: checkout.customerEmail,
          customerPhone: checkout.customerPhone,
          subtotalAmount: discountQuote.subtotalAmount,
          discountAmount: discountQuote.discountAmount,
          totalAmount: discountQuote.totalAmount,
        });
        if (!redemption.success) {
          context.markOrderFailed = true;
          return failure(
            redemption.message,
            "DISCOUNT_CODE_INVALID",
            400
          );
        }
        context.discountReserved = true;
      } catch (error) {
        console.error("[Scalev] Failed to reserve discount redemption:", error);
        context.markOrderFailed = true;
        return failure(
          "Pesanan belum bisa dibuat. Silakan coba lagi.",
          "LOCAL_ORDER_FAILED",
          500
        );
      }
    }

    const orderItems = await createPendingOrderItemsForOrder(
      order.id,
      checkout.lineItems.map((item, index) => ({
        service_id: services[index].id,
        recipient_name: item.recipientName,
        recipient_email: item.recipientEmail || null,
        recipient_phone: item.recipientPhone || null,
        sender_message: item.senderMessage || null,
        delivery_method: item.deliveryMethod,
        send_to: item.sendTo,
        sort_order: index,
      }))
    );
    if (!orderItems || orderItems.length !== checkout.lineItems.length) {
      context.markOrderFailed = true;
      return failure(
        "Pesanan belum bisa dibuat. Silakan coba lagi.",
        "LOCAL_ORDER_FAILED",
        500
      );
    }

    try {
      const scalevOrder = await createScalevOrder({
        customer_name: checkout.customerName,
        customer_email: checkout.customerEmail,
        customer_phone: checkout.customerPhone,
        store_unique_id: storeUniqueId,
        ordervariants: mappings.map((mapping) => ({
          variant_unique_id: mapping.primaryVariant.unique_id,
          quantity: 1,
        })),
        productDiscount: discountQuote?.discountAmount,
        paymentMethod: checkout.paymentMethod,
        subPaymentMethod: checkout.subPaymentMethod,
        metadata: {
          local_order_id: order.id,
          payment_order_id: order.payment_order_id,
          item_count: checkout.lineItems.length,
          subtotal_amount: subtotalAmount,
          discount_code: discountQuote?.code ?? null,
          discount_amount: discountQuote?.discountAmount ?? 0,
          total_amount: totalAmount,
        },
        notes: `Kalanara voucher x${checkout.lineItems.length} - ${order.payment_order_id}`,
      });
      const paymentIntent = scalevOrder.id
        ? await createScalevPaymentIntent(scalevOrder.id).catch((error) => {
            console.warn(
              "[Scalev] create payment intent failed; using order link fallback:",
              error
            );
            return null;
          })
        : null;
      const paymentLink = extractPaymentLink(scalevOrder, paymentIntent);
      const pgReferenceId =
        paymentIntent?.pg_reference_id ||
        paymentIntent?.reference_id ||
        scalevOrder.pg_reference_id ||
        null;
      const gatewayReceiptTime = new Date().toISOString();
      const gatewayUpdate = {
        paymentProvider: "scalev" as const,
        transactionId: pgReferenceId,
        paymentType: scalevOrder.payment_method || checkout.paymentMethod,
        transactionTime: gatewayReceiptTime,
        paymentLink,
        scalevOrderPk: scalevOrder.id,
        scalevOrderId: scalevOrder.order_id || null,
        scalevPgReferenceId: pgReferenceId,
        scalevPaymentMethod:
          scalevOrder.payment_method || checkout.paymentMethod,
        scalevSubPaymentMethod:
          scalevOrder.sub_payment_method || checkout.subPaymentMethod || null,
        scalevStoreUniqueId: storeUniqueId,
        scalevRawStatus: scalevOrder.status || null,
        scalevRawPaymentStatus: scalevOrder.payment_status || null,
        scalevLastCheckedAt: gatewayReceiptTime,
      };
      const receivedGatewayFailureDetails: OrderFailureDetails = {
        paymentProvider: "scalev",
        transactionId: pgReferenceId,
        paymentType: scalevOrder.payment_method || checkout.paymentMethod,
        scalevOrderPk: scalevOrder.id,
        scalevOrderId: scalevOrder.order_id || null,
        scalevPgReferenceId: pgReferenceId,
        scalevPaymentMethod:
          scalevOrder.payment_method || checkout.paymentMethod,
        scalevSubPaymentMethod:
          scalevOrder.sub_payment_method || checkout.subPaymentMethod || null,
        scalevStoreUniqueId: storeUniqueId,
        scalevRawStatus: scalevOrder.status || null,
        scalevRawPaymentStatus: scalevOrder.payment_status || null,
      };
      const gatewayTransition = await transitionOrderPaymentState({
        orderId: order.id,
        targetStatus: "PENDING",
        provider: "scalev",
        providerEventAt: gatewayReceiptTime,
        providerEventAtIsFallback: true,
        gatewayUpdate,
      });

      context.markOrderFailed = true;
      if (!gatewayTransition.accepted) {
        context.failureDetails = receivedGatewayFailureDetails;
        console.error(
          "[Scalev] Failed to persist gateway metadata for local order",
          {
            orderId: order.id,
            paymentOrderId: order.payment_order_id,
            scalevOrderPk: scalevOrder.id,
            scalevPgReferenceId: pgReferenceId,
          }
        );
        return failure(
          "Pesanan belum bisa disiapkan sepenuhnya. Silakan coba lagi.",
          "LOCAL_ORDER_FAILED",
          500
        );
      }
      if (!paymentLink) {
        context.failureDetails = {
          ...receivedGatewayFailureDetails,
          transactionTime: gatewayReceiptTime,
        };
        return failure(
          "Payment link dari Scalev belum tersedia. Silakan coba beberapa saat lagi.",
          "PAYMENT_LINK_MISSING",
          502
        );
      }

      const statusSession = await createOrderStatusSession({
        orderId: order.id,
      });
      context.completed = true;
      return {
        success: true,
        body: {
          success: true,
          paymentLink,
          orderId: scalevOrder.order_id || String(scalevOrder.id),
          paymentOrderId: order.payment_order_id,
          statusSessionId: statusSession.id,
          paymentMethod: checkout.paymentMethod,
          subPaymentMethod: checkout.subPaymentMethod,
        },
        statusSession,
      };
    } catch (error) {
      context.markOrderFailed = true;
      context.failureDetails = baseFailureDetails;
      console.error("[Scalev] create-payment failed:", error);
      return failure(
        discountQuote
          ? "Pembayaran dengan kode diskon belum bisa diproses saat ini. Silakan coba lagi."
          : "Gagal membuat pembayaran Scalev. Silakan coba lagi.",
        discountQuote ? "DISCOUNT_GATEWAY_REJECTED" : "SCALEV_PAYMENT_FAILED",
        502
      );
    }
  } finally {
    await compensateFailedAttempt(context);
  }
}

export async function createScalevCheckout(
  body: unknown
): Promise<CheckoutServiceResult> {
  try {
    const checkout = validateCheckoutRequest(body);
    if (!checkout) {
      return failure(
        "Data checkout tidak valid.",
        "INVALID_CHECKOUT_DATA",
        400
      );
    }

    const availability = await getScalevCheckoutAvailability();
    const methodAllowed = availability.paymentMethods.includes(
      checkout.paymentMethod
    );
    const subMethodAllowed =
      checkout.paymentMethod !== "va" ||
      availability.subPaymentMethods.includes(
        checkout.subPaymentMethod as ScalevVABankCode
      );
    if (!methodAllowed || !subMethodAllowed) {
      return failure(
        "Metode pembayaran tidak tersedia.",
        "PAYMENT_METHOD_UNAVAILABLE",
        400
      );
    }

    const serviceRows = await Promise.all(
      checkout.lineItems.map((item) => getServiceById(item.serviceId))
    );
    if (serviceRows.some((service) => !service || !service.is_active)) {
      return failure(
        "Layanan tidak tersedia.",
        "SERVICE_UNAVAILABLE",
        404
      );
    }
    const services = serviceRows.filter(
      (service): service is NonNullable<typeof service> => Boolean(service)
    );
    const subtotalAmount = services.reduce(
      (sum, service) => sum + service.price,
      0
    );
    const discountValidation = checkout.discountCode
      ? await validateDiscountForCheckout({
          discountCode: checkout.discountCode,
          subtotalAmount,
          customerEmail: checkout.customerEmail,
          customerPhone: checkout.customerPhone,
        })
      : null;
    if (discountValidation && !discountValidation.valid) {
      return failure(
        discountValidation.message,
        "DISCOUNT_CODE_INVALID",
        400
      );
    }

    const discountQuote =
      discountValidation?.valid ? discountValidation.quote : null;
    const totalAmount = discountQuote?.totalAmount ?? subtotalAmount;
    let mappings: Awaited<ReturnType<typeof ensureScalevServiceMapping>>[];
    try {
      mappings = await Promise.all(
        services.map((service) => ensureScalevServiceMapping(service))
      );
    } catch (error) {
      console.error(
        "[Scalev] Catalog synchronization failed before checkout:",
        error
      );
      return failure(
        "Gagal menyiapkan layanan untuk pembayaran. Silakan coba lagi.",
        "SCALEV_PAYMENT_FAILED",
        502
      );
    }

    return await runCheckoutAttempt({
      checkout,
      services,
      mappings,
      discountQuote,
      subtotalAmount,
      totalAmount,
      storeUniqueId: getScalevConfig().storeUniqueId,
    });
  } catch (error) {
    console.error("[Scalev] Unexpected create-payment error:", error);
    return failure(
      "Terjadi kendala saat menyiapkan pembayaran. Silakan coba lagi.",
      "INTERNAL_ERROR",
      500
    );
  }
}
