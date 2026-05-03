import { createHmac, timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import type { Json } from "@/lib/database.types";
import {
  getOrderItemsByOrderId,
  getOrderByScalevOrderId,
  getOrderByScalevOrderPk,
  getOrderByScalevPgReferenceId,
  updateOrderGatewayData,
  updateOrderPaymentStatus,
} from "@/lib/actions/orders";
import {
  createScalevWebhookEvent,
  updateScalevWebhookEvent,
} from "@/lib/actions/scalevWebhookEvents";
import { createVoucherOnPaymentSuccess } from "@/lib/payment/voucher-service";
import { getScalevConfig } from "@/lib/scalev/config";
import type {
  ScalevNormalizedPaymentStatus,
  ScalevWebhookPayload,
  ScalevWebhookPaymentStatusChangedData,
} from "@/lib/scalev/types";

function buildWebhookEventHash(rawBody: string) {
  return createHmac("sha256", "scalev-webhook-event")
    .update(rawBody, "utf8")
    .digest("hex");
}

function toJsonValue(value: unknown): Json | null {
  if (value === undefined) {
    return null;
  }

  return JSON.parse(JSON.stringify(value)) as Json;
}

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

async function isOrderAlreadyFulfilled(order: Awaited<ReturnType<typeof findOrderFromWebhook>>) {
  if (!order) {
    return false;
  }

  const items = await getOrderItemsByOrderId(order.id);
  if (items.length > 0) {
    return items.every((item) => Boolean(item.voucher_id && item.vouchers));
  }

  return Boolean(order.voucher_id);
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    provider: "scalev",
    message: "Webhook endpoint is ready",
  });
}

export async function HEAD() {
  return new NextResponse(null, { status: 200 });
}

export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  const signature = request.headers.get("X-Scalev-Hmac-Sha256");
  const eventHash = buildWebhookEventHash(rawBody);

  if (!validateWebhookSignature(rawBody, signature)) {
    const invalidSignatureRecord = await createScalevWebhookEvent({
      event_type: "invalid_signature",
      external_event_hash: eventHash,
      signature,
      payload: null,
      processing_status: "failed",
      processing_message: "Invalid webhook signature",
      processed_at: new Date().toISOString(),
    });

    if (invalidSignatureRecord) {
      await updateScalevWebhookEvent(invalidSignatureRecord.id, {
        processing_status: "failed",
        processing_message: "Invalid webhook signature",
        processed_at: new Date().toISOString(),
      });
    }

    return NextResponse.json(
      { status: "error", message: "Invalid signature" },
      { status: 401 }
    );
  }

  let body: unknown;
  try {
    body = JSON.parse(rawBody);
  } catch {
    const invalidJsonRecord = await createScalevWebhookEvent({
      event_type: "invalid_json",
      external_event_hash: eventHash,
      signature,
      payload: null,
      processing_status: "failed",
      processing_message: "Invalid JSON payload",
      processed_at: new Date().toISOString(),
    });

    if (invalidJsonRecord) {
      await updateScalevWebhookEvent(invalidJsonRecord.id, {
        processing_status: "failed",
        processing_message: "Invalid JSON payload",
        processed_at: new Date().toISOString(),
      });
    }

    return NextResponse.json(
      { status: "error", message: "Invalid JSON" },
      { status: 400 }
    );
  }

  if (!isScalevWebhookPayload(body)) {
    const invalidPayloadRecord = await createScalevWebhookEvent({
      event_type: "invalid_payload",
      external_event_hash: eventHash,
      signature,
      payload: toJsonValue(body),
      processing_status: "ignored",
      processing_message: "Ignored invalid payload",
      processed_at: new Date().toISOString(),
    });

    if (invalidPayloadRecord) {
      await updateScalevWebhookEvent(invalidPayloadRecord.id, {
        processing_status: "ignored",
        processing_message: "Ignored invalid payload",
        processed_at: new Date().toISOString(),
      });
    }

    return NextResponse.json(
      { status: "ok", message: "Ignored invalid payload" },
      { status: 200 }
    );
  }

  const webhookEvent = await createScalevWebhookEvent({
    event_type: body.event,
    external_event_hash: eventHash,
    signature,
    payload: toJsonValue(body),
    scalev_order_pk:
      typeof body.data === "object" && body.data !== null && "id" in body.data
        ? Number((body.data as { id?: unknown }).id) || null
        : null,
    scalev_order_id:
      typeof body.data === "object" && body.data !== null && "order_id" in body.data
        ? String((body.data as { order_id?: unknown }).order_id || "") || null
        : null,
    scalev_pg_reference_id:
      typeof body.data === "object" && body.data !== null && "pg_reference_id" in body.data
        ? String((body.data as { pg_reference_id?: unknown }).pg_reference_id || "") || null
        : null,
    payment_status:
      typeof body.data === "object" && body.data !== null && "payment_status" in body.data
        ? String((body.data as { payment_status?: unknown }).payment_status || "") || null
        : null,
    processing_status: "received",
  });

  if (
    webhookEvent?.processed_at &&
    ["processed", "ignored"].includes(webhookEvent.processing_status)
  ) {
    return NextResponse.json({ status: "ok", message: "Duplicate event ignored" });
  }

  if (body.event === "business.test_event") {
    if (webhookEvent) {
      await updateScalevWebhookEvent(webhookEvent.id, {
        processing_status: "processed",
        processing_message: "Test event acknowledged",
        processed_at: new Date().toISOString(),
      });
    }

    return NextResponse.json({ status: "ok", message: "Test event acknowledged" });
  }

  if (body.event !== "order.payment_status_changed") {
    if (webhookEvent) {
      await updateScalevWebhookEvent(webhookEvent.id, {
        processing_status: "ignored",
        processing_message: "Event ignored",
        processed_at: new Date().toISOString(),
      });
    }

    return NextResponse.json({ status: "ok", message: "Event ignored" });
  }

  const data = body.data as ScalevWebhookPaymentStatusChangedData | undefined;
  if (!data) {
    if (webhookEvent) {
      await updateScalevWebhookEvent(webhookEvent.id, {
        processing_status: "ignored",
        processing_message: "Missing event data",
        processed_at: new Date().toISOString(),
      });
    }

    return NextResponse.json(
      { status: "ok", message: "Missing event data" },
      { status: 200 }
    );
  }

  const order = await findOrderFromWebhook(data);
  if (!order) {
    console.warn("[Scalev Webhook] Unable to match webhook to local order", data);
    if (webhookEvent) {
      await updateScalevWebhookEvent(webhookEvent.id, {
        processing_status: "ignored",
        processing_message: "Order not found",
        processed_at: new Date().toISOString(),
      });
    }

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
    if (webhookEvent) {
      await updateScalevWebhookEvent(webhookEvent.id, {
        order_id: order.id,
        processing_status: "processed",
        processing_message: "Pending status recorded",
        processed_at: new Date().toISOString(),
      });
    }

    return NextResponse.json({ status: "ok", message: "Pending status recorded" });
  }

  if (normalizedStatus === "FAILED") {
    await updateOrderPaymentStatus(order.id, "FAILED", gatewayUpdate);
    if (webhookEvent) {
      await updateScalevWebhookEvent(webhookEvent.id, {
        order_id: order.id,
        processing_status: "processed",
        processing_message: "Failure status recorded",
        processed_at: new Date().toISOString(),
      });
    }

    return NextResponse.json({ status: "ok", message: "Failure status recorded" });
  }

  if (normalizedStatus === "REFUNDED") {
    await updateOrderPaymentStatus(order.id, "REFUNDED", gatewayUpdate);
    if (webhookEvent) {
      await updateScalevWebhookEvent(webhookEvent.id, {
        order_id: order.id,
        processing_status: "processed",
        processing_message: "Refund status recorded",
        processed_at: new Date().toISOString(),
      });
    }

    return NextResponse.json({ status: "ok", message: "Refund status recorded" });
  }

  await updateOrderPaymentStatus(order.id, "COMPLETED", gatewayUpdate);

  let processingStatus: "processed" | "failed" = "processed";
  let processingMessage = "Webhook processed";

  const alreadyFulfilled = await isOrderAlreadyFulfilled(order);
  if (alreadyFulfilled) {
    processingMessage = "Payment completed; vouchers already fulfilled";
  } else {
    try {
      const result = await createVoucherOnPaymentSuccess({
        ...order,
        payment_status: "COMPLETED",
      });
      if (!result.success) {
        processingStatus = "failed";
        processingMessage = result.error || "Payment completed, but voucher creation failed";
      }
    } catch (error) {
      console.error("[Scalev Webhook] Voucher creation failed:", error);
      processingStatus = "failed";
      processingMessage = "Payment completed, but voucher creation failed";
    }
  }

  if (webhookEvent) {
    await updateScalevWebhookEvent(webhookEvent.id, {
      order_id: order.id,
      processing_status: processingStatus,
      processing_message: processingMessage,
      processed_at: new Date().toISOString(),
    });
  }

  return NextResponse.json({ status: "ok", message: "Webhook processed" });
}
