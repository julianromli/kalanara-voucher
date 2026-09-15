import "server-only";

import { getPublicOrderDetailsWithItems } from "@/lib/payment/order-capability-reads";

export interface AuthorizedVoucherDelivery {
  orderId: string;
  token: string;
  voucherCode: string;
  recipientEmail: string | null;
  recipientPhone: string | null;
  recipientName: string;
  senderName: string;
  senderMessage: string | null;
  serviceName: string;
  serviceDuration: number;
  amount: number;
  expiryDate: string;
}

type PublicOrderWithItems = NonNullable<Awaited<ReturnType<typeof getPublicOrderDetailsWithItems>>>;
type PublicOrderItem = PublicOrderWithItems["order_items"][number];
type DeliveryVoucher = NonNullable<PublicOrderItem["vouchers"]>;
type DeliveryService = NonNullable<PublicOrderItem["services"]>;

function getRecipientPhone(order: PublicOrderWithItems, item: PublicOrderItem) {
  return item.send_to === "RECIPIENT"
    ? item.recipient_phone
    : order.customer_phone;
}

function getServerAppUrl(): string {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.trim();

  if (!appUrl) {
    throw new Error("Missing required environment variable: NEXT_PUBLIC_APP_URL");
  }

  return appUrl.replace(/\/+$/, "");
}

function mapAuthorizedVoucherDelivery(
  order: PublicOrderWithItems,
  voucher: DeliveryVoucher,
  service: DeliveryService,
  recipientPhone: string | null
): AuthorizedVoucherDelivery {
  return {
    orderId: order.payment_order_id || order.id,
    token: order.public_access_token,
    voucherCode: voucher.code,
    recipientEmail: voucher.recipient_email,
    recipientPhone,
    recipientName: voucher.recipient_name,
    senderName: voucher.sender_name,
    senderMessage: voucher.sender_message,
    serviceName: service.name,
    serviceDuration: service.duration,
    amount: voucher.amount,
    expiryDate: voucher.expiry_date,
  };
}

function toDelivery(
  order: PublicOrderWithItems,
  item: PublicOrderItem
): AuthorizedVoucherDelivery | null {
  if (!item.vouchers || !item.services) {
    return null;
  }

  return mapAuthorizedVoucherDelivery(
    order,
    item.vouchers,
    item.services,
    getRecipientPhone(order, item)
  );
}

function toLegacyDelivery(
  order: PublicOrderWithItems
): AuthorizedVoucherDelivery | null {
  const voucher = order.vouchers;
  const service = voucher?.services ?? order.services;
  if (!voucher || !service) {
    return null;
  }

  return mapAuthorizedVoucherDelivery(
    order,
    voucher,
    service,
    order.send_to === "RECIPIENT"
      ? order.recipient_phone
      : order.customer_phone
  );
}

export async function getAuthorizedVoucherDeliveries(
  orderId: string,
  token: string
): Promise<AuthorizedVoucherDelivery[]> {
  const order = await getPublicOrderDetailsWithItems(orderId, token);
  if (!order || order.payment_status !== "COMPLETED") {
    return [];
  }

  if (order.order_items.length === 0) {
    const legacyDelivery = toLegacyDelivery(order);
    return legacyDelivery ? [legacyDelivery] : [];
  }

  return order.order_items
    .map((item) => toDelivery(order, item))
    .filter((delivery): delivery is AuthorizedVoucherDelivery => Boolean(delivery));
}

export async function getAuthorizedVoucherDelivery(
  orderId: string,
  token: string,
  orderItemId?: string
): Promise<AuthorizedVoucherDelivery | null> {
  const order = await getPublicOrderDetailsWithItems(orderId, token);
  if (!order || order.payment_status !== "COMPLETED") {
    return null;
  }

  if (order.order_items.length === 0 && !orderItemId) {
    return toLegacyDelivery(order);
  }

  const item = orderItemId
    ? order.order_items.find((entry) => entry.id === orderItemId)
    : order.order_items[0];
  return item ? toDelivery(order, item) : null;
}

async function postVoucherDelivery(
  path: "/api/email/send-voucher" | "/api/whatsapp/send-voucher",
  orderId: string,
  token: string,
  orderItemId?: string
) {
  const response = await fetch(`${getServerAppUrl()}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ orderId, token, orderItemId }),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "");
    throw new Error(
      `${path} failed with status ${response.status}${errorText ? `: ${errorText}` : ""}`
    );
  }

  return response;
}

export async function sendVoucherEmail(
  orderId: string,
  token: string,
  orderItemId?: string
) {
  await postVoucherDelivery("/api/email/send-voucher", orderId, token, orderItemId);
}

export async function sendVoucherWhatsApp(
  orderId: string,
  token: string,
  orderItemId?: string
): Promise<string> {
  const response = await postVoucherDelivery(
    "/api/whatsapp/send-voucher",
    orderId,
    token,
    orderItemId
  );
  const payload: unknown = await response.json().catch(() => null);

  if (!payload || typeof payload !== "object") {
    throw new Error("Invalid WhatsApp delivery response");
  }

  const { success, whatsappUrl } = payload as Record<string, unknown>;
  if (
    success !== true ||
    typeof whatsappUrl !== "string" ||
    whatsappUrl.length === 0 ||
    whatsappUrl.length > 8_192 ||
    whatsappUrl !== whatsappUrl.trim()
  ) {
    throw new Error("Invalid WhatsApp delivery response");
  }

  try {
    const parsedUrl = new URL(whatsappUrl);
    if (
      parsedUrl.protocol !== "https:" ||
      parsedUrl.hostname !== "wa.me" ||
      parsedUrl.port !== "" ||
      parsedUrl.username !== "" ||
      parsedUrl.password !== "" ||
      !/^\/\d+$/.test(parsedUrl.pathname) ||
      !parsedUrl.searchParams.has("text") ||
      parsedUrl.hash !== ""
    ) {
      throw new Error("Unexpected WhatsApp URL");
    }
  } catch {
    throw new Error("Invalid WhatsApp delivery response");
  }

  return whatsappUrl;
}
