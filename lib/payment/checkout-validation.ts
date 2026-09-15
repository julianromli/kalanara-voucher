import { normalizeCustomerPhone } from "@/lib/discounts/service";
import {
  isScalevPaymentMethod,
  isScalevVABankCode,
  type ScalevCheckoutLineItem,
  type ScalevPaymentMethod,
  type ScalevVABankCode,
} from "@/lib/scalev/types";
import { DeliveryMethod, SendTo } from "@/lib/types";

export interface ValidatedCheckoutLineItem extends ScalevCheckoutLineItem {
  customerName: string;
  customerEmail: string;
  customerPhone: string;
}

export interface ValidatedCheckoutRequest {
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  discountCode?: string;
  paymentMethod: ScalevPaymentMethod;
  subPaymentMethod?: ScalevVABankCode;
  lineItems: ValidatedCheckoutLineItem[];
}

type CheckoutCustomer = Pick<
  ValidatedCheckoutRequest,
  "customerName" | "customerEmail" | "customerPhone"
>;

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

function normalizeLineItem(
  value: unknown,
  customer: CheckoutCustomer
): ValidatedCheckoutLineItem | null {
  if (typeof value !== "object" || value === null) {
    return null;
  }

  const data = value as Record<string, unknown>;
  const serviceId = getOptionalString(data.serviceId);
  const recipientName = getOptionalString(data.recipientName);
  const deliveryMethod = getOptionalString(data.deliveryMethod);
  const sendTo = getOptionalString(data.sendTo);

  if (
    !serviceId ||
    !recipientName ||
    !deliveryMethod ||
    !sendTo ||
    !isDeliveryMethod(deliveryMethod) ||
    !isSendTo(sendTo)
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
    deliveryMethod,
    sendTo,
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

export function validateCheckoutRequest(
  body: unknown
): ValidatedCheckoutRequest | null {
  if (typeof body !== "object" || body === null) {
    return null;
  }

  const data = body as Record<string, unknown>;
  const customerName = getOptionalString(data.customerName);
  const customerEmail = getOptionalString(data.customerEmail);
  const customerPhone = getOptionalString(data.customerPhone);
  const paymentMethod =
    typeof data.paymentMethod === "string" ? data.paymentMethod : "";

  if (
    !customerName ||
    !customerEmail ||
    !customerPhone ||
    !isScalevPaymentMethod(paymentMethod)
  ) {
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
  const legacyLineItem =
    lineItems.length === 0 ? normalizeLineItem(data, customer) : null;
  const normalizedLineItems =
    lineItems.length > 0 ? lineItems : legacyLineItem ? [legacyLineItem] : [];

  if (
    normalizedLineItems.length === 0 ||
    normalizedLineItems.some((item) => !hasRequiredDeliveryTarget(item))
  ) {
    return null;
  }

  const subPaymentMethod =
    typeof data.subPaymentMethod === "string"
      ? data.subPaymentMethod
      : undefined;
  if (
    paymentMethod === "va" &&
    (!subPaymentMethod || !isScalevVABankCode(subPaymentMethod))
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
      paymentMethod === "va" && subPaymentMethod
        ? (subPaymentMethod as ScalevVABankCode)
        : undefined,
  };
}
