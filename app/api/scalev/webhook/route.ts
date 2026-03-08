import { createHmac, timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import {
  getOrderByScalevOrderId,
  getOrderByScalevOrderPk,
  getOrderByScalevPgReferenceId,
  updateOrderGatewayData,
  updateOrderPaymentStatus,
} from "@/lib/actions/orders";
import { createVoucherOnPaymentSuccess } from "@/lib/payment/voucher-service";
import { getScalevConfig } from "@/lib/scalev/config";
import type {
  ScalevNormalizedPaymentStatus,
  ScalevWebhookPayload,
  ScalevWebhookPaymentStatusChangedData,
} from "@/lib/scalev/types";

function isScalevWebhookPayload(value: unknown): value is ScalevWebhookPayload {
  return (
    typeof value === "object" &&
    value !== null &&
    "event" in value &&
    typeof (value as { event?: unknown }).event === "string"
  );
}

function validateWebhookSignature(
  rawBody: string,
  signature: string | null
): boolean {
  const config = getScalevConfig();

  if (!config.webhookSigningSecret) {
    if (process.env.NODE_ENV === "production") {
      console.error("[Scalev Webhook] Missing SCALEV_WEBHOOK_SIGNING_SECRET in production");
      return false;
    }

    console.warn("[Scalev Webhook] Signature verification disabled outside production");
    return true;
  }

  if (!signature) {
    console.error("[Scalev Webhook] Missing X-Scalev-Hmac-Sha256 header");
    return false;
  }

  const expectedSignature = createHmac("sha256", config.webhookSigningSecret)
    .update(rawBody, "utf8")
    .digest("base64");

  const providedBuffer = Buffer.from(signature, "utf8");
  const expectedBuffer = Buffer.from(expectedSignature, "utf8");

  if (providedBuffer.length !== expectedBuffer.length) {
    return false;
  }

  return timingSafeEqual(providedBuffer, expectedBuffer);
}

function normalizeWebhookPaymentStatus(
  paymentStatus?: string | null
): ScalevNormalizedPaymentStatus {
  const normalized = paymentStatus?.toLowerCase();

  switch (normalized) {
    case "paid":
    case "settled":
      return "COMPLETED";
    case "refunded":
      return "REFUNDED";
    case "failed":
    case "expired":
    case "canceled":
    case "cancelled":
      return "FAILED";
    default:
      return "PENDING";
  }
}

function extractWebhookTransactionTime(
  payload: ScalevWebhookPaymentStatusChangedData
): string {
  return (
    payload.settled_time ||
    payload.paid_time ||
    payload.conflict_time ||
    payload.unpaid_time ||
    payload.last_updated_at ||
    new Date().toISOString()
  );
}

async function findOrderFromWebhook(payload: ScalevWebhookPaymentStatusChangedData) {
  if (payload.id) {
    const order = await getOrderByScalevOrderPk(payload.id);
    if (order) {
      return order;
    }
  }

  if (payload.pg_reference_id) {
    const order = await getOrderByScalevPgReferenceId(payload.pg_reference_id);
    if (order) {
      return order;
    }
  }

  if (payload.order_id) {
    return getOrderByScalevOrderId(payload.order_id);
  }

  return null;
}

export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  const signature = request.headers.get("X-Scalev-Hmac-Sha256");

  if (!validateWebhookSignature(rawBody, signature)) {
    return NextResponse.json(
      { status: "error", message: "Invalid signature" },
      { status: 401 }
    );
  }

  let body: unknown;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return NextResponse.json(
      { status: "error", message: "Invalid JSON" },
      { status: 400 }
    );
  }

  if (!isScalevWebhookPayload(body)) {
    return NextResponse.json(
      { status: "ok", message: "Ignored invalid payload" },
      { status: 200 }
    );
  }

  if (body.event === "business.test_event") {
    return NextResponse.json({ status: "ok", message: "Test event acknowledged" });
  }

  if (body.event !== "order.payment_status_changed") {
    return NextResponse.json({ status: "ok", message: "Event ignored" });
  }

  const data = body.data as ScalevWebhookPaymentStatusChangedData | undefined;
  if (!data) {
    return NextResponse.json(
      { status: "ok", message: "Missing event data" },
      { status: 200 }
    );
  }

  const order = await findOrderFromWebhook(data);
  if (!order) {
    console.warn("[Scalev Webhook] Unable to match webhook to local order", data);
    return NextResponse.json({ status: "ok", message: "Order not found" });
  }

  const normalizedStatus = normalizeWebhookPaymentStatus(data.payment_status);
  const gatewayUpdate = {
    paymentProvider: "scalev",
    transactionId: data.pg_reference_id || order.payment_transaction_id,
    paymentType: data.payment_method || order.scalev_payment_method,
    transactionTime: extractWebhookTransactionTime(data),
    paymentLink: order.payment_link,
    scalevOrderPk: data.id || order.scalev_order_pk,
    scalevOrderId: data.order_id || order.scalev_order_id,
    scalevPgReferenceId: data.pg_reference_id || order.scalev_pg_reference_id,
    scalevPaymentMethod: data.payment_method || order.scalev_payment_method,
    scalevSubPaymentMethod:
      data.sub_payment_method || order.scalev_sub_payment_method,
    scalevStoreUniqueId: order.scalev_store_unique_id,
    scalevRawStatus: order.scalev_raw_status,
    scalevRawPaymentStatus: data.payment_status || order.scalev_raw_payment_status,
    scalevLastCheckedAt: new Date().toISOString(),
  };

  if (normalizedStatus === "PENDING") {
    await updateOrderGatewayData(order.id, gatewayUpdate);
    return NextResponse.json({ status: "ok", message: "Pending status recorded" });
  }

  if (normalizedStatus === "FAILED") {
    await updateOrderPaymentStatus(order.id, "FAILED", gatewayUpdate);
    return NextResponse.json({ status: "ok", message: "Failure status recorded" });
  }

  if (normalizedStatus === "REFUNDED") {
    await updateOrderPaymentStatus(order.id, "REFUNDED", gatewayUpdate);
    return NextResponse.json({ status: "ok", message: "Refund status recorded" });
  }

  await updateOrderPaymentStatus(order.id, "COMPLETED", gatewayUpdate);

  if (!order.voucher_id) {
    try {
      await createVoucherOnPaymentSuccess({
        ...order,
        payment_status: "COMPLETED",
      });
    } catch (error) {
      console.error("[Scalev Webhook] Voucher creation failed:", error);
    }
  }

  return NextResponse.json({ status: "ok", message: "Webhook processed" });
}
