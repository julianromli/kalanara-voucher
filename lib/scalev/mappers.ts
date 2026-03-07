import {
  type PublicOrderStatusPayload,
  type ScalevNormalizedPaymentStatus,
  type ScalevPaymentMethod,
  type ScalevPaymentSnapshot,
  type ScalevPaymentStatusResponse,
  type ScalevSettlementStatusResponse,
  type ScalevStoreRecord,
  type ScalevVABankCode,
} from "@/lib/scalev/types";
import type { OrderWithVoucher } from "@/lib/database.types";
import { DeliveryMethod, SendTo } from "@/lib/types";
import { buildScalevPublicOrderUrl } from "@/lib/scalev/urls";

const PENDING_STATUSES = new Set([
  "unpaid",
  "pending",
  "created",
  "draft",
  "confirmed",
  "in_process",
  "ready",
  "conflict",
]);

const COMPLETED_STATUSES = new Set(["paid", "settled", "completed", "shipped"]);
const FAILED_STATUSES = new Set(["canceled", "cancelled", "expired", "closed", "failed"]);
const REFUNDED_STATUSES = new Set(["refund", "refunded"]);

export function normalizeScalevStatus(
  paymentStatus?: string | null,
  orderStatus?: string | null
): ScalevNormalizedPaymentStatus {
  const candidates = [paymentStatus, orderStatus]
    .map((value) => value?.trim().toLowerCase())
    .filter((value): value is string => Boolean(value));

  if (candidates.some((value) => REFUNDED_STATUSES.has(value))) return "REFUNDED";
  if (candidates.some((value) => COMPLETED_STATUSES.has(value))) return "COMPLETED";
  if (candidates.some((value) => FAILED_STATUSES.has(value))) return "FAILED";
  if (candidates.some((value) => PENDING_STATUSES.has(value))) return "PENDING";

  return "PENDING";
}

export function mapScalevPaymentMethodToLocal(
  paymentMethod?: string | null
): "BANK_TRANSFER" | "E_WALLET" | "CREDIT_CARD" {
  const method = paymentMethod?.trim().toLowerCase();

  if (!method) return "BANK_TRANSFER";

  if (method === "card") return "CREDIT_CARD";

  if (method === "va" || method === "invoice") return "BANK_TRANSFER";

  return "E_WALLET";
}

export function extractScalevPaymentMethods(store: ScalevStoreRecord): {
  methods: ScalevPaymentMethod[];
  subMethods: ScalevVABankCode[];
} {
  return {
    methods: (store.payment_methods || []).filter(Boolean) as ScalevPaymentMethod[],
    subMethods: (store.sub_payment_methods || []).filter(Boolean) as ScalevVABankCode[],
  };
}

export function buildPaymentSnapshot(
  payment: ScalevPaymentStatusResponse | null,
  settlement: ScalevSettlementStatusResponse | null
): ScalevPaymentSnapshot {
  const paymentStatus = payment?.payment_status ?? settlement?.payment_status ?? null;
  const orderStatus = payment?.status ?? settlement?.status ?? null;

  return {
    orderPk: payment?.id ?? settlement?.id ?? null,
    orderId: payment?.order_id ?? settlement?.order_id ?? null,
    pgReferenceId:
      payment?.pg_reference_id ?? settlement?.pg_reference_id ?? null,
    paymentLink:
      payment?.invoice_url ??
      buildScalevPublicOrderUrl(payment?.secret_slug) ??
      null,
    paymentMethod: payment?.payment_method ?? null,
    subPaymentMethod: payment?.sub_payment_method ?? null,
    rawPaymentStatus: paymentStatus,
    rawStatus: orderStatus,
    normalizedStatus: normalizeScalevStatus(paymentStatus, orderStatus),
  };
}

export function buildPublicOrderStatus(
  order: OrderWithVoucher
): PublicOrderStatusPayload {
  const voucher = order.vouchers;
  const status =
    order.payment_status === "COMPLETED" && voucher
      ? "completed"
      : order.payment_status === "FAILED" || order.payment_status === "REFUNDED"
        ? "failed"
        : "pending";

  return {
    status,
    orderId: order.payment_order_id || order.id,
    paymentStatus: order.payment_status,
    paymentMethod: order.scalev_payment_method || order.payment_type,
    provider: order.payment_provider,
    message:
      status === "pending"
        ? "Pembayaran masih diverifikasi."
        : status === "failed"
          ? "Pembayaran tidak berhasil diproses."
          : undefined,
    voucher: voucher
      ? {
          voucherCode: voucher.code,
          paymentOrderId: order.payment_order_id || "",
          recipientName: order.recipient_name || "",
          recipientEmail: order.recipient_email,
          recipientPhone: order.recipient_phone || "",
          senderName: order.customer_name,
          senderMessage: order.sender_message,
          serviceName: voucher.services?.name || "Layanan Spa",
          serviceDuration: voucher.services?.duration || 60,
          amount: order.total_amount,
          expiryDate: voucher.expiry_date,
          deliveryMethod: order.delivery_method as DeliveryMethod,
          sendTo: order.send_to as SendTo,
        }
      : undefined,
  };
}
