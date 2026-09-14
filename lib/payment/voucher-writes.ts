import "server-only";

import crypto from "node:crypto";
import { revalidateTag } from "next/cache";
import { getAdminClient } from "@/lib/supabase/admin";
import type {
  Database,
  Order,
  OrderItem,
  Voucher,
} from "@/lib/database.types";
import { updateOrderItemVoucherId, updateOrderVoucherId } from "@/lib/payment/order-writes";

function generateVoucherCode(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  const randomBytes = crypto.randomBytes(8);
  const randomPart = Array.from(
    { length: 8 },
    (_, index) => chars[randomBytes[index] % chars.length]
  ).join("");
  return `KSP-${new Date().getFullYear()}-${randomPart}`;
}

function calculateExpiryDate(): string {
  const expiryDate = new Date();
  expiryDate.setFullYear(expiryDate.getFullYear() + 1);
  return expiryDate.toISOString();
}

async function getVoucherBy(
  column: "id" | "code" | "source_order_id" | "source_order_item_id",
  value: string
): Promise<Voucher | null> {
  const supabase = getAdminClient();
  const { data, error } = await supabase
    .from("vouchers")
    .select("*")
    .eq(column, value)
    .single();

  if (error) {
    if ("code" in error && error.code === "PGRST116") {
      return null;
    }
    console.error("Error fetching payment voucher:", error);
    return null;
  }

  return data as Voucher;
}

async function insertVoucher(
  voucherData: Omit<
    Database["public"]["Tables"]["vouchers"]["Insert"],
    "code"
  >
): Promise<Voucher | null> {
  const supabase = getAdminClient();
  let code = generateVoucherCode();

  for (let attempts = 0; attempts < 5; attempts += 1) {
    const existing = await getVoucherBy("code", code);
    if (!existing) {
      break;
    }
    code = generateVoucherCode();
  }

  const { data, error } = await supabase
    .from("vouchers")
    .insert({ ...voucherData, code })
    .select()
    .single();

  if (error) {
    if ("code" in error && error.code === "23505") {
      if (voucherData.source_order_item_id) {
        return getVoucherBy(
          "source_order_item_id",
          voucherData.source_order_item_id
        );
      }
      if (voucherData.source_order_id) {
        return getVoucherBy("source_order_id", voucherData.source_order_id);
      }
    }

    console.error("Error creating voucher:", error);
    return null;
  }

  revalidateTag("dashboard-stats", "max");
  return data as Voucher;
}

async function loadCompletedOrder(orderId: string): Promise<Order> {
  const supabase = getAdminClient();
  const { data, error } = await supabase
    .from("orders")
    .select("*")
    .eq("id", orderId)
    .single();

  if (error || !data || data.payment_status !== "COMPLETED") {
    throw new Error("Order is not eligible for voucher fulfillment");
  }

  return data as Order;
}

async function loadOrderItem(
  orderId: string,
  orderItemId: string
): Promise<OrderItem> {
  const supabase = getAdminClient();
  const { data, error } = await supabase
    .from("order_items")
    .select("*")
    .eq("id", orderItemId)
    .single();

  if (error || !data || data.order_id !== orderId) {
    throw new Error("Order item is not eligible for voucher fulfillment");
  }

  return data as OrderItem;
}

export async function createVoucherForPaidOrderItem(
  orderId: string,
  orderItemId: string
): Promise<Voucher | null> {
  const [order, item] = await Promise.all([
    loadCompletedOrder(orderId),
    loadOrderItem(orderId, orderItemId),
  ]);

  if (item.voucher_id) {
    return getVoucherBy("id", item.voucher_id);
  }

  const existingVoucher = await getVoucherBy(
    "source_order_item_id",
    item.id
  );
  if (existingVoucher) {
    if (!(await updateOrderItemVoucherId(item.id, existingVoucher.id))) {
      throw new Error(
        `Failed to relink existing voucher ${existingVoucher.id} to order item ${item.id}`
      );
    }
    return existingVoucher;
  }

  const recipientEmail =
    item.send_to === "RECIPIENT"
      ? item.recipient_email ?? order.customer_email
      : order.customer_email;
  if (!recipientEmail) {
    throw new Error("Order missing effective email contact");
  }

  const voucher = await insertVoucher({
    source_order_id: null,
    source_order_item_id: item.id,
    service_id: item.service_id,
    recipient_name: item.recipient_name,
    recipient_email: recipientEmail,
    sender_name: order.customer_name,
    sender_message: item.sender_message,
    expiry_date: calculateExpiryDate(),
    amount: item.unit_price,
    is_redeemed: false,
  });

  if (
    voucher &&
    !(await updateOrderItemVoucherId(item.id, voucher.id))
  ) {
    throw new Error(
      `Failed to link voucher ${voucher.id} to order item ${item.id}`
    );
  }

  return voucher;
}

export async function createVoucherForPaidOrder(
  orderId: string
): Promise<Voucher | null> {
  const order = await loadCompletedOrder(orderId);

  if (order.voucher_id) {
    return getVoucherBy("id", order.voucher_id);
  }

  const existingVoucher = await getVoucherBy("source_order_id", order.id);
  if (existingVoucher) {
    if (!(await updateOrderVoucherId(order.id, existingVoucher.id))) {
      throw new Error(
        `Failed to relink existing voucher ${existingVoucher.id} to order ${order.id}`
      );
    }
    return existingVoucher;
  }

  const recipientEmail =
    order.send_to === "RECIPIENT"
      ? order.recipient_email ?? order.customer_email
      : order.customer_email;
  if (!order.service_id || !order.recipient_name || !recipientEmail) {
    throw new Error("Order is missing voucher fulfillment data");
  }

  const voucher = await insertVoucher({
    source_order_id: order.id,
    source_order_item_id: null,
    service_id: order.service_id,
    recipient_name: order.recipient_name,
    recipient_email: recipientEmail,
    sender_name: order.customer_name,
    sender_message: order.sender_message,
    expiry_date: calculateExpiryDate(),
    amount: order.total_amount,
    is_redeemed: false,
  });

  if (voucher && !(await updateOrderVoucherId(order.id, voucher.id))) {
    throw new Error(`Failed to link voucher ${voucher.id} to order ${order.id}`);
  }

  return voucher;
}
