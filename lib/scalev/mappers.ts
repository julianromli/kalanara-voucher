import {
  type PublicOrderPaymentInstructions,
  type PublicOrderStatusPayload,
  type PublicOrderVoucherPayload,
  type ScalevNormalizedPaymentStatus,
  type ScalevPaymentMethod,
  type ScalevPaymentSnapshot,
  type ScalevPaymentStatusResponse,
  type ScalevSettlementStatusResponse,
  type ScalevStoreRecord,
  type ScalevVABankCode,
} from "@/lib/scalev/types";
import type {
  OrderItemWithService,
  OrderWithItems,
  OrderWithVoucher,
} from "@/lib/database.types";
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

function extractScalevPaymentInstructions(
  payment: ScalevPaymentStatusResponse | null
): PublicOrderPaymentInstructions | undefined {
  const qrCode = payment?.pg_payment_info?.payment_method?.qr_code;
  const qrString = qrCode?.channel_properties?.qr_string?.trim();

  if (!qrString) {
    return undefined;
  }

  return {
    kind: "qris",
    qrString,
    amount: qrCode?.amount ?? payment?.pg_payment_info?.amount ?? null,
    expiresAt: qrCode?.channel_properties?.expires_at ?? null,
    channelCode: qrCode?.channel_code ?? null,
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
    paymentInstructions: extractScalevPaymentInstructions(payment),
    paymentMethod: payment?.payment_method ?? null,
    subPaymentMethod: payment?.sub_payment_method ?? null,
    rawPaymentStatus: paymentStatus,
    rawStatus: orderStatus,
    normalizedStatus: normalizeScalevStatus(paymentStatus, orderStatus),
  };
}

function buildVoucherPayloadFromOrderItem(
  order: OrderWithItems,
  item: OrderItemWithService
): PublicOrderVoucherPayload | null {
  const voucher = item.vouchers;
  if (!voucher) {
    return null;
  }

  const recipientPhone =
    item.send_to === "RECIPIENT"
      ? item.recipient_phone || ""
      : order.customer_phone;

  return {
    voucherCode: voucher.code,
    paymentOrderId: order.payment_order_id || "",
    recipientName: item.recipient_name,
    recipientEmail: item.recipient_email,
    recipientPhone,
    senderName: order.customer_name,
    senderMessage: item.sender_message,
    serviceName: item.services?.name || "Layanan Spa",
    serviceDuration: item.services?.duration || 60,
    amount: item.unit_price,
    expiryDate: voucher.expiry_date,
    deliveryMethod: item.delivery_method as DeliveryMethod,
    sendTo: item.send_to as SendTo,
  };
}

function buildLegacyVoucherPayload(
  order: OrderWithVoucher
): PublicOrderVoucherPayload | undefined {
  const voucher = order.vouchers;
  if (!voucher) {
    return undefined;
  }

  return {
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
  };
}

export function buildPublicOrderStatus(
  order: OrderWithVoucher,
  paymentInstructions?: PublicOrderPaymentInstructions
): PublicOrderStatusPayload {
  const voucher = order.vouchers;
  const status =
    order.payment_status === "COMPLETED" && voucher
      ? "completed"
      : order.payment_status === "FAILED" || order.payment_status === "REFUNDED"
        ? "failed"
        : "pending";
  const legacyVoucher = buildLegacyVoucherPayload(order);

  return {
    status,
    orderId: order.payment_order_id || order.id,
    paymentStatus: order.payment_status,
    paymentMethod: order.scalev_payment_method || order.payment_type,
    provider: order.payment_provider,
    paymentLink: order.payment_link,
    paymentInstructions,
    message:
      status === "pending"
        ? "Pembayaran masih diverifikasi."
        : status === "failed"
          ? "Pembayaran tidak berhasil diproses."
          : undefined,
    voucher: legacyVoucher,
    vouchers: legacyVoucher ? [legacyVoucher] : [],
    orderDetails: {
      customerName: order.customer_name,
      customerEmail: order.customer_email,
      customerPhone: order.customer_phone,
      subtotalAmount: order.subtotal_amount,
      discountAmount: order.discount_amount,
      discountCode: order.discount_code,
      totalAmount: order.total_amount,
      createdAt: order.created_at,
      items: [
        {
          serviceName: order.vouchers?.services?.name || order.services?.name || "Layanan Spa",
          quantity: 1,
          originalPrice: order.subtotal_amount,
          price: order.total_amount,
        },
      ],
    },
  };
}

export function buildPublicOrderStatusWithItems(
  order: OrderWithItems,
  paymentInstructions?: PublicOrderPaymentInstructions
): PublicOrderStatusPayload {
  const vouchers = order.order_items
    .map((item) => buildVoucherPayloadFromOrderItem(order, item))
    .filter((item): item is PublicOrderVoucherPayload => Boolean(item));
  const expectedVoucherCount = order.order_items.length;
  const isComplete =
    order.payment_status === "COMPLETED" &&
    expectedVoucherCount > 0 &&
    vouchers.length === expectedVoucherCount;
  const status = isComplete
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
    paymentLink: order.payment_link,
    paymentInstructions,
    message:
      status === "pending"
        ? "Pembayaran masih diverifikasi."
        : status === "failed"
          ? "Pembayaran tidak berhasil diproses."
          : undefined,
    voucher: vouchers[0],
    vouchers,
    orderDetails: {
      customerName: order.customer_name,
      customerEmail: order.customer_email,
      customerPhone: order.customer_phone,
      subtotalAmount: order.subtotal_amount,
      discountAmount: order.discount_amount,
      discountCode: order.discount_code,
      totalAmount: order.total_amount,
      createdAt: order.created_at,
      items: order.order_items.map(item => ({
        serviceName: item.services?.name || "Layanan Spa",
        quantity: 1,
        originalPrice: item.original_unit_price,
        price: item.unit_price,
      })),
    },
  };
}
