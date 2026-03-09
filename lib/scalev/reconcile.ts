import "server-only";

import {
  getOrderByPaymentOrderIdAndAccessToken,
  getPublicOrderDetails,
  updateOrderGatewayData,
  updateOrderPaymentStatus,
} from "@/lib/actions/orders";
import { createVoucherOnPaymentSuccess } from "@/lib/payment/voucher-service";
import {
  checkScalevPaymentStatus,
  checkScalevSettlementStatus,
  getScalevOrderByPgReference,
  retrieveScalevOrder,
} from "@/lib/scalev/client";
import { buildPaymentSnapshot, buildPublicOrderStatus } from "@/lib/scalev/mappers";
import type { PublicOrderStatusPayload, ScalevPaymentStatusResponse } from "@/lib/scalev/types";

export async function reconcilePublicOrderStatus(
  paymentOrderId: string,
  publicAccessToken: string
): Promise<PublicOrderStatusPayload | null> {
  const order = await getOrderByPaymentOrderIdAndAccessToken(
    paymentOrderId,
    publicAccessToken
  );
  if (!order) {
    return null;
  }

  const existingPublicOrder = await getPublicOrderDetails(
    paymentOrderId,
    publicAccessToken
  );
  if (!existingPublicOrder) {
    return null;
  }

  if (
    existingPublicOrder.payment_status === "COMPLETED" &&
    existingPublicOrder.voucher_id &&
    existingPublicOrder.vouchers
  ) {
    return buildPublicOrderStatus(existingPublicOrder);
  }

  if (existingPublicOrder.payment_provider !== "scalev") {
    return buildPublicOrderStatus(existingPublicOrder);
  }

  let orderPk = existingPublicOrder.scalev_order_pk;

  if (!orderPk && existingPublicOrder.scalev_pg_reference_id) {
    const externalOrder = await getScalevOrderByPgReference(
      existingPublicOrder.scalev_pg_reference_id
    );

    if (externalOrder?.id) {
      orderPk = externalOrder.id;
      await updateOrderGatewayData(existingPublicOrder.id, {
        paymentProvider: "scalev",
        paymentLink: externalOrder.invoice_url || externalOrder.payment_link || null,
        scalevOrderPk: externalOrder.id,
        scalevOrderId: externalOrder.order_id || null,
        scalevPgReferenceId: externalOrder.pg_reference_id || null,
        scalevPaymentMethod: externalOrder.payment_method || null,
        scalevSubPaymentMethod: externalOrder.sub_payment_method || null,
        scalevRawStatus: externalOrder.status || null,
        scalevRawPaymentStatus: externalOrder.payment_status || null,
        scalevLastCheckedAt: new Date().toISOString(),
      });
    }
  }

  if (!orderPk) {
    return buildPublicOrderStatus(existingPublicOrder);
  }

  const [payment, settlement] = await Promise.all([
    checkScalevPaymentStatus(orderPk).catch(() => null),
    checkScalevSettlementStatus(orderPk).catch(() => null),
  ]);

  let latestPayment = payment;
  if (!latestPayment) {
    const orderRecord = await retrieveScalevOrder(orderPk).catch(() => null);
    latestPayment = orderRecord as ScalevPaymentStatusResponse | null;
  }

  const snapshot = buildPaymentSnapshot(latestPayment, settlement);

  await updateOrderGatewayData(existingPublicOrder.id, {
    paymentProvider: "scalev",
    transactionId:
      snapshot.pgReferenceId || existingPublicOrder.payment_transaction_id,
    paymentType: snapshot.paymentMethod,
    transactionTime: new Date().toISOString(),
    paymentLink: snapshot.paymentLink || existingPublicOrder.payment_link,
    scalevOrderPk: snapshot.orderPk || orderPk,
    scalevOrderId: snapshot.orderId || existingPublicOrder.scalev_order_id,
    scalevPgReferenceId:
      snapshot.pgReferenceId || existingPublicOrder.scalev_pg_reference_id,
    scalevPaymentMethod:
      snapshot.paymentMethod || existingPublicOrder.scalev_payment_method,
    scalevSubPaymentMethod:
      snapshot.subPaymentMethod || existingPublicOrder.scalev_sub_payment_method,
    scalevStoreUniqueId: existingPublicOrder.scalev_store_unique_id,
    scalevRawStatus: snapshot.rawStatus,
    scalevRawPaymentStatus: snapshot.rawPaymentStatus,
    scalevLastCheckedAt: new Date().toISOString(),
  });

  if (snapshot.normalizedStatus === "COMPLETED") {
    await updateOrderPaymentStatus(existingPublicOrder.id, "COMPLETED", {
      paymentProvider: "scalev",
      transactionId: snapshot.pgReferenceId || existingPublicOrder.payment_transaction_id,
      paymentType: snapshot.paymentMethod,
      transactionTime: new Date().toISOString(),
      paymentLink: snapshot.paymentLink || existingPublicOrder.payment_link,
      scalevOrderPk: snapshot.orderPk || orderPk,
      scalevOrderId: snapshot.orderId || existingPublicOrder.scalev_order_id,
      scalevPgReferenceId:
        snapshot.pgReferenceId || existingPublicOrder.scalev_pg_reference_id,
      scalevPaymentMethod:
        snapshot.paymentMethod || existingPublicOrder.scalev_payment_method,
      scalevSubPaymentMethod:
        snapshot.subPaymentMethod || existingPublicOrder.scalev_sub_payment_method,
      scalevStoreUniqueId: existingPublicOrder.scalev_store_unique_id,
      scalevRawStatus: snapshot.rawStatus,
      scalevRawPaymentStatus: snapshot.rawPaymentStatus,
      scalevLastCheckedAt: new Date().toISOString(),
    });

    const latestOrder = await getOrderByPaymentOrderIdAndAccessToken(
      paymentOrderId,
      publicAccessToken
    );
    if (latestOrder) {
      await createVoucherOnPaymentSuccess(latestOrder);
    }
  } else if (snapshot.normalizedStatus === "FAILED") {
    await updateOrderPaymentStatus(existingPublicOrder.id, "FAILED", {
      paymentProvider: "scalev",
      transactionId: snapshot.pgReferenceId || existingPublicOrder.payment_transaction_id,
      paymentType: snapshot.paymentMethod,
      scalevOrderPk: snapshot.orderPk || orderPk,
      scalevOrderId: snapshot.orderId || existingPublicOrder.scalev_order_id,
      scalevPgReferenceId:
        snapshot.pgReferenceId || existingPublicOrder.scalev_pg_reference_id,
      scalevPaymentMethod:
        snapshot.paymentMethod || existingPublicOrder.scalev_payment_method,
      scalevSubPaymentMethod:
        snapshot.subPaymentMethod || existingPublicOrder.scalev_sub_payment_method,
      scalevStoreUniqueId: existingPublicOrder.scalev_store_unique_id,
      scalevRawStatus: snapshot.rawStatus,
      scalevRawPaymentStatus: snapshot.rawPaymentStatus,
      scalevLastCheckedAt: new Date().toISOString(),
    });
  } else if (snapshot.normalizedStatus === "REFUNDED") {
    await updateOrderPaymentStatus(existingPublicOrder.id, "REFUNDED", {
      paymentProvider: "scalev",
      transactionId: snapshot.pgReferenceId || existingPublicOrder.payment_transaction_id,
      paymentType: snapshot.paymentMethod,
      scalevOrderPk: snapshot.orderPk || orderPk,
      scalevOrderId: snapshot.orderId || existingPublicOrder.scalev_order_id,
      scalevPgReferenceId:
        snapshot.pgReferenceId || existingPublicOrder.scalev_pg_reference_id,
      scalevPaymentMethod:
        snapshot.paymentMethod || existingPublicOrder.scalev_payment_method,
      scalevSubPaymentMethod:
        snapshot.subPaymentMethod || existingPublicOrder.scalev_sub_payment_method,
      scalevStoreUniqueId: existingPublicOrder.scalev_store_unique_id,
      scalevRawStatus: snapshot.rawStatus,
      scalevRawPaymentStatus: snapshot.rawPaymentStatus,
      scalevLastCheckedAt: new Date().toISOString(),
    });
  }

  const refreshed = await getPublicOrderDetails(paymentOrderId, publicAccessToken);
  return refreshed ? buildPublicOrderStatus(refreshed) : null;
}
