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

function getRecipientPhone(
  order: Awaited<ReturnType<typeof getPublicOrderDetailsWithItems>>,
  item: NonNullable<Awaited<ReturnType<typeof getPublicOrderDetailsWithItems>>>["order_items"][number]
) {
  if (!order) {
    return null;
  }

  return item.send_to === "RECIPIENT"
    ? item.recipient_phone
    : order.customer_phone;
}

export async function getAuthorizedVoucherDelivery(
  orderId: string,
  token: string
): Promise<AuthorizedVoucherDelivery | null> {
  const order = await getPublicOrderDetailsWithItems(orderId, token);
  if (!order || order.payment_status !== "COMPLETED") {
    return null;
  }

  const firstItemWithVoucher = order.order_items.find(
    (item) => item.vouchers && item.services
  );
  if (!firstItemWithVoucher?.vouchers || !firstItemWithVoucher.services) {
    return null;
  }

  return {
    orderId,
    token,
    voucherCode: firstItemWithVoucher.vouchers.code,
    recipientEmail: firstItemWithVoucher.vouchers.recipient_email,
    recipientPhone: getRecipientPhone(order, firstItemWithVoucher),
    recipientName: firstItemWithVoucher.vouchers.recipient_name,
    senderName: firstItemWithVoucher.vouchers.sender_name,
    senderMessage: firstItemWithVoucher.vouchers.sender_message,
    serviceName: firstItemWithVoucher.services.name,
    serviceDuration: firstItemWithVoucher.services.duration,
    amount: firstItemWithVoucher.vouchers.amount,
    expiryDate: firstItemWithVoucher.vouchers.expiry_date,
  };
}
