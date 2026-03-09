import "server-only";

import { getPublicOrderDetails } from "@/lib/actions/orders";

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

export async function getAuthorizedVoucherDelivery(
  orderId: string,
  token: string
): Promise<AuthorizedVoucherDelivery | null> {
  const order = await getPublicOrderDetails(orderId, token);
  if (!order || order.payment_status !== "COMPLETED" || !order.vouchers || !order.vouchers.services) {
    return null;
  }

  const recipientPhone =
    order.send_to === "RECIPIENT"
      ? order.recipient_phone
      : order.customer_phone;

  return {
    orderId,
    token,
    voucherCode: order.vouchers.code,
    recipientEmail: order.vouchers.recipient_email,
    recipientPhone,
    recipientName: order.vouchers.recipient_name,
    senderName: order.vouchers.sender_name,
    senderMessage: order.vouchers.sender_message,
    serviceName: order.vouchers.services.name,
    serviceDuration: order.vouchers.services.duration,
    amount: order.vouchers.amount,
    expiryDate: order.vouchers.expiry_date,
  };
}
