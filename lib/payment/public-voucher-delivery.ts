import "server-only";

import { getPublicOrderDetailsWithItems } from "@/lib/actions/orders";

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

function toDelivery(
  order: PublicOrderWithItems,
  item: PublicOrderItem
): AuthorizedVoucherDelivery | null {
  if (!item.vouchers || !item.services) {
    return null;
  }

  return {
    orderId: order.payment_order_id || order.id,
    token: order.public_access_token,
    voucherCode: item.vouchers.code,
    recipientEmail: item.vouchers.recipient_email,
    recipientPhone: getRecipientPhone(order, item),
    recipientName: item.vouchers.recipient_name,
    senderName: item.vouchers.sender_name,
    senderMessage: item.vouchers.sender_message,
    serviceName: item.services.name,
    serviceDuration: item.services.duration,
    amount: item.vouchers.amount,
    expiryDate: item.vouchers.expiry_date,
  };
}

export async function getAuthorizedVoucherDeliveries(
  orderId: string,
  token: string
): Promise<AuthorizedVoucherDelivery[]> {
  const order = await getPublicOrderDetailsWithItems(orderId, token);
  if (!order || order.payment_status !== "COMPLETED") {
    return [];
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
) {
  await postVoucherDelivery("/api/whatsapp/send-voucher", orderId, token, orderItemId);
}
