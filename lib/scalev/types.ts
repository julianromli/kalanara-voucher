import type { DeliveryMethod, SendTo } from "@/lib/types";

export const SCALEV_PAYMENT_METHODS = [
  "qris",
  "invoice",
  "va",
  "gopay",
  "ovo",
  "dana",
  "shopeepay",
  "linkaja",
] as const;

export const SCALEV_VA_BANK_CODES = [
  "BCA",
  "BNI",
  "BRI",
  "MANDIRI",
  "PERMATA",
  "BSI",
  "BJB",
  "CIMB",
  "SAHABAT_SAMPOERNA",
  "ARTAJASA",
] as const;

export type ScalevPaymentMethod = (typeof SCALEV_PAYMENT_METHODS)[number];
export type ScalevVABankCode = (typeof SCALEV_VA_BANK_CODES)[number];
export type CheckoutDiscountType = "FIXED_AMOUNT" | "PERCENTAGE";

export type ScalevNormalizedPaymentStatus =
  | "PENDING"
  | "COMPLETED"
  | "FAILED"
  | "REFUNDED";

export type ScalevPublicStatus = "loading" | "pending" | "completed" | "failed";

export interface ScalevPaymentSelection {
  paymentMethod: ScalevPaymentMethod;
  subPaymentMethod?: ScalevVABankCode;
}

export interface ScalevCheckoutLineItem {
  serviceId: string;
  recipientName: string;
  recipientEmail?: string;
  recipientPhone?: string;
  senderMessage?: string;
  deliveryMethod: DeliveryMethod;
  sendTo: SendTo;
}

interface ScalevCheckoutBaseRequest extends ScalevPaymentSelection {
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  discountCode?: string;
}

export interface ScalevLegacyCheckoutRequest extends ScalevCheckoutBaseRequest {
  serviceId: string;
  lineItems?: never;
  recipientName: string;
  recipientEmail?: string;
  recipientPhone?: string;
  senderMessage?: string;
  deliveryMethod: DeliveryMethod;
  sendTo: SendTo;
}

export interface ScalevCartCheckoutRequest extends ScalevCheckoutBaseRequest {
  serviceId?: never;
  lineItems: ScalevCheckoutLineItem[];
  recipientName?: never;
  recipientEmail?: never;
  recipientPhone?: never;
  senderMessage?: never;
  deliveryMethod?: never;
  sendTo?: never;
}

export type ScalevCheckoutRequest =
  | ScalevLegacyCheckoutRequest
  | ScalevCartCheckoutRequest;

export type ScalevCreatePaymentErrorCode =
  | "INVALID_CHECKOUT_DATA"
  | "SERVICE_UNAVAILABLE"
  | "PAYMENT_METHOD_UNAVAILABLE"
  | "DISCOUNT_CODE_INVALID"
  | "DISCOUNT_GATEWAY_REJECTED"
  | "LOCAL_ORDER_FAILED"
  | "SCALEV_PAYMENT_FAILED"
  | "PAYMENT_LINK_MISSING"
  | "INTERNAL_ERROR";

export interface ScalevCreatePaymentResponse {
  success: boolean;
  paymentLink?: string;
  orderId?: string;
  paymentOrderId?: string;
  publicAccessToken?: string;
  paymentMethod?: ScalevPaymentMethod;
  subPaymentMethod?: ScalevVABankCode;
  error?: string;
  errorCode?: ScalevCreatePaymentErrorCode;
}

export interface CheckoutDiscountSummary {
  code: string;
  discountType: CheckoutDiscountType;
  discountValue: number;
  subtotalAmount: number;
  discountAmount: number;
  totalAmount: number;
}

export interface DiscountCodePreviewResponse {
  success: boolean;
  pricing?: CheckoutDiscountSummary;
  error?: string;
}

export interface ScalevPendingOrderData {
  service_id?: string | null;
  customer_email: string;
  customer_name: string;
  customer_phone: string;
  recipient_name?: string | null;
  recipient_email?: string | null;
  recipient_phone?: string | null;
  sender_message?: string | null;
  delivery_method?: DeliveryMethod | null;
  send_to?: SendTo | null;
  subtotal_amount: number;
  discount_code_id?: string | null;
  discount_code?: string | null;
  discount_type_snapshot?: CheckoutDiscountType | null;
  discount_value_snapshot?: number | null;
  discount_amount?: number;
  total_amount: number;
  payment_method?: ScalevPaymentMethod;
  sub_payment_method?: ScalevVABankCode;
}

export interface ScalevPendingOrderItemData {
  order_id: string;
  service_id: string;
  original_unit_price: number;
  discount_amount: number;
  final_unit_price: number;
  unit_price: number;
  recipient_name: string;
  recipient_email?: string | null;
  recipient_phone?: string | null;
  sender_message?: string | null;
  delivery_method: DeliveryMethod;
  send_to: SendTo;
  sort_order: number;
}

export interface ScalevPaymentOption {
  code: ScalevPaymentMethod;
  label: string;
  subMethods?: ScalevVABankCode[];
}

export interface ScalevCheckoutConfig {
  storeUniqueId: string;
  paymentOptions: ScalevPaymentOption[];
  disabledPaymentMethods?: ScalevPaymentMethod[];
  paymentNotice?: string;
}

export interface ScalevProductVariantInput {
  name: string;
  price: number;
  weight: number;
  metadata?: Record<string, unknown>;
  variantId?: number;
}

export interface ScalevCatalogProductInput {
  name: string;
  description?: string;
  publicName?: string;
  richDescription?: string;
  itemType: "digital";
  metaThumbnail?: string;
  variants: ScalevProductVariantInput[];
}

export interface ScalevProductVariant {
  id: number;
  unique_id: string;
  name: string;
  price: number;
  weight: number;
  metadata?: Record<string, unknown>;
}

export interface ScalevProductRecord {
  id: number;
  name: string;
  display?: string;
  item_type?: string;
  variants: ScalevProductVariant[];
}

export interface ScalevStoreRecord {
  id: number;
  name: string;
  unique_id: string;
  payment_methods?: ScalevPaymentMethod[];
  sub_payment_methods?: ScalevVABankCode[];
}

export interface ScalevOrderVariantLine {
  variant_unique_id: string;
  quantity: number;
}

export interface ScalevOrderCreateInput extends ScalevPaymentSelection {
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  store_unique_id: string;
  ordervariants: ScalevOrderVariantLine[];
  productDiscount?: number;
  notes?: string;
  metadata?: Record<string, unknown>;
}

export interface ScalevOrderRecord {
  id: number;
  order_id?: string;
  payment_status?: string | null;
  status?: string | null;
  payment_method?: string | null;
  sub_payment_method?: string | null;
  pg_reference_id?: string | null;
  invoice_url?: string | null;
  payment_link?: string | null;
  secret_slug?: string | null;
  metadata?: Record<string, unknown> | null;
}

export interface ScalevPaymentIntentResponse {
  payment_url?: string;
  invoice_url?: string;
  reference_id?: string;
  pg_reference_id?: string;
  [key: string]: unknown;
}

export interface ScalevQrCodeProperties {
  expires_at?: string | null;
  qr_string?: string | null;
}

export interface ScalevQrCodeInfo {
  amount?: number | null;
  channel_code?: string | null;
  channel_properties?: ScalevQrCodeProperties | null;
}

export interface ScalevGatewayPaymentMethodInfo {
  qr_code?: ScalevQrCodeInfo | null;
}

export interface ScalevGatewayPaymentInfo {
  amount?: number | null;
  payment_method?: ScalevGatewayPaymentMethodInfo | null;
}

export interface ScalevPaymentStatusResponse {
  id?: number;
  order_id?: string;
  payment_status?: string | null;
  status?: string | null;
  pg_reference_id?: string | null;
  payment_method?: string | null;
  sub_payment_method?: string | null;
  invoice_url?: string | null;
  secret_slug?: string | null;
  pg_payment_info?: ScalevGatewayPaymentInfo | null;
}

export interface ScalevSettlementStatusResponse {
  id?: number;
  order_id?: string;
  payment_status?: string | null;
  status?: string | null;
  pg_reference_id?: string | null;
}

export interface ScalevPaymentSnapshot {
  orderPk?: number | null;
  orderId?: string | null;
  pgReferenceId?: string | null;
  paymentLink?: string | null;
  paymentInstructions?: PublicOrderPaymentInstructions;
  paymentMethod?: string | null;
  subPaymentMethod?: string | null;
  rawPaymentStatus?: string | null;
  rawStatus?: string | null;
  normalizedStatus: ScalevNormalizedPaymentStatus;
}

export interface PublicOrderQrisInstructions {
  kind: "qris";
  qrString: string;
  amount?: number | null;
  expiresAt?: string | null;
  channelCode?: string | null;
}

export type PublicOrderPaymentInstructions = PublicOrderQrisInstructions;

export interface PublicOrderVoucherPayload {
  voucherCode: string;
  paymentOrderId: string;
  recipientName: string;
  recipientEmail?: string | null;
  recipientPhone: string;
  senderName: string;
  senderMessage?: string | null;
  serviceName: string;
  serviceDuration: number;
  amount: number;
  expiryDate: string;
  deliveryMethod: DeliveryMethod;
  sendTo: SendTo;
}

export interface PublicOrderDetailsPayload {
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  subtotalAmount: number;
  discountAmount: number;
  discountCode?: string | null;
  totalAmount: number;
  createdAt: string;
  items: Array<{
    serviceName: string;
    quantity: number;
    price: number;
    originalPrice?: number;
  }>;
}

export interface PublicOrderStatusPayload {
  status: ScalevPublicStatus;
  orderId: string;
  paymentStatus: ScalevNormalizedPaymentStatus;
  paymentMethod?: string | null;
  provider?: string | null;
  message?: string;
  paymentLink?: string | null;
  paymentInstructions?: PublicOrderPaymentInstructions;
  voucher?: PublicOrderVoucherPayload;
  vouchers?: PublicOrderVoucherPayload[];
  orderDetails?: PublicOrderDetailsPayload;
}

export interface ScalevApiEnvelope<T> {
  code: number;
  status: string;
  data: T;
}

export interface ScalevWebhookPaymentStatusHistoryItem {
  at?: string | null;
  status?: string | null;
}

export interface ScalevWebhookPaymentStatusChangedData {
  id?: number;
  order_id?: string;
  payment_status?: string | null;
  payment_method?: string | null;
  sub_payment_method?: string | null;
  pg_reference_id?: string | null;
  paid_time?: string | null;
  settled_time?: string | null;
  conflict_time?: string | null;
  unpaid_time?: string | null;
  last_updated_at?: string | null;
  payment_status_history?: ScalevWebhookPaymentStatusHistoryItem[] | null;
}

export interface ScalevWebhookPayload {
  event: string;
  timestamp?: string;
  data?: ScalevWebhookPaymentStatusChangedData | Record<string, unknown>;
}
