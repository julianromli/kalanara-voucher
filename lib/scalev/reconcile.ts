import "server-only";

import {
  getOrderForStatusById,
  getOrderStatusDetailsById,
  getOrderStatusDetailsWithItemsById,
} from "@/lib/payment/order-status-reads";
import {
  transitionOrderPaymentState,
  type GatewayPaymentUpdate,
  type PaymentTransitionResult,
} from "@/lib/payment/payment-state";
import {
  markDiscountRedemptionSucceeded,
  markDiscountRedemptionVoid,
} from "@/lib/discounts/service";
import { createVoucherOnPaymentSuccess } from "@/lib/payment/voucher-service";
import {
  checkScalevPaymentStatus,
  checkScalevSettlementStatus,
  getScalevOrderByPgReference,
  retrieveScalevOrder,
} from "@/lib/scalev/client";
import {
  buildPaymentSnapshot,
  buildPublicOrderStatus,
  buildPublicOrderStatusWithItems,
} from "@/lib/scalev/mappers";
import { resolveScalevProviderEventAt } from "@/lib/scalev/provider-event-time";
import type {
  PublicOrderStatusPayload,
  ScalevPaymentSnapshot,
  ScalevPaymentStatusResponse,
} from "@/lib/scalev/types";

function buildCurrentPublicStatus(
  orderWithItems: Awaited<ReturnType<typeof getOrderStatusDetailsWithItemsById>>,
  legacyOrder: NonNullable<Awaited<ReturnType<typeof getOrderStatusDetailsById>>>,
  paymentInstructions?: PublicOrderStatusPayload["paymentInstructions"]
) {
  return orderWithItems?.order_items.length
    ? buildPublicOrderStatusWithItems(orderWithItems, paymentInstructions)
    : buildPublicOrderStatus(legacyOrder, paymentInstructions);
}

async function loadCurrentPublicStatus(
  internalOrderId: string,
  paymentInstructions?: PublicOrderStatusPayload["paymentInstructions"]
): Promise<PublicOrderStatusPayload | null> {
  const [orderWithItems, legacyOrder] = await Promise.all([
    getOrderStatusDetailsWithItemsById(internalOrderId),
    getOrderStatusDetailsById(internalOrderId),
  ]);
  return legacyOrder
    ? buildCurrentPublicStatus(orderWithItems, legacyOrder, paymentInstructions)
    : null;
}

function buildGatewayUpdate(
  snapshot: ScalevPaymentSnapshot,
  existingOrder: NonNullable<
    Awaited<ReturnType<typeof getOrderStatusDetailsById>>
  >,
  orderPk: number,
  observedAt: string
): GatewayPaymentUpdate {
  return {
    paymentProvider: "scalev",
    transactionId:
      snapshot.pgReferenceId || existingOrder.payment_transaction_id,
    paymentType: snapshot.paymentMethod,
    transactionTime: observedAt,
    paymentLink: snapshot.paymentLink || existingOrder.payment_link,
    scalevOrderPk: snapshot.orderPk || orderPk,
    scalevOrderId: snapshot.orderId || existingOrder.scalev_order_id,
    scalevPgReferenceId:
      snapshot.pgReferenceId || existingOrder.scalev_pg_reference_id,
    scalevPaymentMethod:
      snapshot.paymentMethod || existingOrder.scalev_payment_method,
    scalevSubPaymentMethod:
      snapshot.subPaymentMethod || existingOrder.scalev_sub_payment_method,
    scalevStoreUniqueId: existingOrder.scalev_store_unique_id,
    scalevRawStatus: snapshot.rawStatus,
    scalevRawPaymentStatus: snapshot.rawPaymentStatus,
    scalevLastCheckedAt: observedAt,
  };
}

function logRejectedReconciliation(transition: PaymentTransitionResult) {
  if (!transition.accepted) {
    // Do not log order/customer identifiers or provider payloads.
    console.warn(
      `[Scalev] Reconciliation payment transition stopped: ${transition.reason}.`
    );
  }
}

export async function reconcilePublicOrderStatusByInternalOrderId(
  internalOrderId: string
): Promise<PublicOrderStatusPayload | null> {
  const receivedAt = new Date().toISOString();
  const order = await getOrderForStatusById(internalOrderId);
  if (!order) {
    return null;
  }

  const [existingOrderWithItems, existingPublicOrder] = await Promise.all([
    getOrderStatusDetailsWithItemsById(internalOrderId),
    getOrderStatusDetailsById(internalOrderId),
  ]);

  if (!existingPublicOrder) {
    return null;
  }

  if (
    existingPublicOrder.payment_status === "COMPLETED" &&
    (existingOrderWithItems?.order_items.some((item) => item.vouchers) ||
      (existingPublicOrder.voucher_id && existingPublicOrder.vouchers))
  ) {
    return buildCurrentPublicStatus(existingOrderWithItems, existingPublicOrder);
  }

  if (existingPublicOrder.payment_provider !== "scalev") {
    return buildCurrentPublicStatus(existingOrderWithItems, existingPublicOrder);
  }

  let orderPk = existingPublicOrder.scalev_order_pk;
  let discoveredPayment: ScalevPaymentStatusResponse | null = null;

  if (!orderPk && existingPublicOrder.scalev_pg_reference_id) {
    const externalOrder = await getScalevOrderByPgReference(
      existingPublicOrder.scalev_pg_reference_id
    );

    if (externalOrder?.id) {
      orderPk = externalOrder.id;
      discoveredPayment = externalOrder as ScalevPaymentStatusResponse;
    }
  }

  if (!orderPk) {
    return buildCurrentPublicStatus(existingOrderWithItems, existingPublicOrder);
  }

  const [payment, settlement] = await Promise.all([
    checkScalevPaymentStatus(orderPk).catch(() => null),
    checkScalevSettlementStatus(orderPk).catch(() => null),
  ]);

  let latestPayment = payment;
  if (!latestPayment) {
    const orderRecord = await retrieveScalevOrder(orderPk).catch(() => null);
    latestPayment =
      (orderRecord as ScalevPaymentStatusResponse | null) || discoveredPayment;
  }

  const snapshot = buildPaymentSnapshot(latestPayment, settlement);
  const providerEventAt = resolveScalevProviderEventAt(
    snapshot.providerEventAt,
    receivedAt,
    "reconciliation"
  );
  const transition = await transitionOrderPaymentState({
    orderId: existingPublicOrder.id,
    targetStatus: snapshot.normalizedStatus,
    provider: "scalev",
    providerEventAt,
    gatewayUpdate: buildGatewayUpdate(
      snapshot,
      existingPublicOrder,
      orderPk,
      receivedAt
    ),
  });
  if (!transition.accepted) {
    logRejectedReconciliation(transition);
    return loadCurrentPublicStatus(
      internalOrderId,
      snapshot.paymentInstructions
    );
  }

  if (transition.currentStatus === "COMPLETED") {
    const redemptionMarked = await markDiscountRedemptionSucceeded(existingPublicOrder.id);
    if (!redemptionMarked) {
      throw new Error("Failed to synchronize discount redemption after payment success.");
    }

    const refreshedBeforeFulfillment =
      await getOrderStatusDetailsWithItemsById(internalOrderId);
    const latestOrder = await getOrderForStatusById(internalOrderId);
    const alreadyFulfilled =
      refreshedBeforeFulfillment?.order_items.length
        ? refreshedBeforeFulfillment.order_items.every((item) => item.voucher_id)
        : Boolean(latestOrder?.voucher_id);
    if (
      !alreadyFulfilled &&
      latestOrder?.payment_status === "COMPLETED"
    ) {
      await createVoucherOnPaymentSuccess(latestOrder);
    }
  } else if (transition.currentStatus === "FAILED") {
    const redemptionVoided = await markDiscountRedemptionVoid(existingPublicOrder.id);
    if (!redemptionVoided) {
      throw new Error("Failed to void discount redemption after payment failure.");
    }
  }

  const refreshedWithItems =
    await getOrderStatusDetailsWithItemsById(internalOrderId);
  if (refreshedWithItems?.order_items.length) {
    return buildPublicOrderStatusWithItems(refreshedWithItems, snapshot.paymentInstructions);
  }

  const refreshed = await getOrderStatusDetailsById(internalOrderId);
  return refreshed
    ? buildPublicOrderStatus(refreshed, snapshot.paymentInstructions)
    : null;
}
