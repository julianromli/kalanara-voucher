"use server";

import { createClient } from "@/lib/supabase/server";
import { getAdminClient } from "@/lib/supabase/admin";
import { revalidateTag } from "next/cache";
import type { Database, Order, OrderInsert, OrderWithVoucher } from "@/lib/database.types";

export async function getOrders(): Promise<OrderWithVoucher[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("orders")
    .select(`*, vouchers(*, services(*))`)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching orders:", error);
    return [];
  }

  return (data as OrderWithVoucher[]) || [];
}

export async function getOrderById(id: string): Promise<OrderWithVoucher | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("orders")
    .select(`*, vouchers(*, services(*))`)
    .eq("id", id)
    .single();

  if (error) {
    console.error("Error fetching order:", error);
    return null;
  }

  return data as OrderWithVoucher;
}

export async function createOrder(order: OrderInsert): Promise<Order | null> {
  // Use admin client to bypass RLS for trusted server operations
  const supabase = getAdminClient();
  const { data, error } = await supabase
    .from("orders")
    .insert(order as Database["public"]["Tables"]["orders"]["Insert"])
    .select()
    .single();

  if (error) {
    console.error("Error creating order:", error);
    return null;
  }

  revalidateTag("dashboard-stats", "max");
  return data as Order;
}

export async function updateOrderStatus(
  id: string,
  status: Order["payment_status"]
): Promise<boolean> {
  const supabase = getAdminClient();
  const { error } = await supabase
    .from("orders")
    .update({ payment_status: status } as Database["public"]["Tables"]["orders"]["Update"])
    .eq("id", id);

  if (!error) revalidateTag("dashboard-stats", "max");
  return !error;
}

export async function getOrderStats(): Promise<{
  totalRevenue: number;
  totalOrders: number;
  completedOrders: number;
  pendingOrders: number;
}> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("orders")
    .select("total_amount, payment_status");

  if (error || !data) {
    return {
      totalRevenue: 0,
      totalOrders: 0,
      completedOrders: 0,
      pendingOrders: 0,
    };
  }

  type OrderStat = { total_amount: number; payment_status: string };
  const orders = data as OrderStat[];
  const completedOrders = orders.filter((o) => o.payment_status === "COMPLETED");
  const pendingOrders = orders.filter((o) => o.payment_status === "PENDING");

  return {
    totalRevenue: completedOrders.reduce((sum, o) => sum + o.total_amount, 0),
    totalOrders: orders.length,
    completedOrders: completedOrders.length,
    pendingOrders: pendingOrders.length,
  };
}


// ============================================================================
// Midtrans Integration Functions
// ============================================================================

import type { PendingOrderData, MidtransPaymentData } from "@/lib/midtrans/types";
import type { PaymentStatus, OrderWithService } from "@/lib/database.types";

/**
 * Generate a unique Midtrans order ID
 * Format: KSP-{timestamp}-{random}
 * @returns Unique order ID string
 */
function generateMidtransOrderId(): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `KSP-${timestamp}-${random}`;
}

/**
 * Check if a Midtrans order ID already exists in the database
 * @param midtransOrderId - The order ID to check
 * @returns true if exists, false otherwise
 */
export async function checkMidtransOrderIdExists(midtransOrderId: string): Promise<boolean> {
  const supabase = getAdminClient();
  const { data } = await supabase
    .from("orders")
    .select("id")
    .eq("midtrans_order_id", midtransOrderId)
    .single();
  
  return data !== null;
}

/**
 * Generate a unique Midtrans order ID with collision check
 * Retries up to 3 times if collision detected
 * @returns Unique order ID string
 */
export async function generateUniqueMidtransOrderId(): Promise<string> {
  const maxRetries = 3;
  
  for (let i = 0; i < maxRetries; i++) {
    const orderId = generateMidtransOrderId();
    const exists = await checkMidtransOrderIdExists(orderId);
    
    if (!exists) {
      return orderId;
    }
  }
  
  // Fallback: add extra random suffix
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 10).toUpperCase();
  return `KSP-${timestamp}-${random}`;
}

/**
 * Create a pending order before payment
 * Order is created with PENDING status and null voucher_id
 * Voucher will be created after payment confirmation via webhook
 * 
 * @param data - Pending order data including customer and recipient info
 * @returns Created order or null if failed
 */
export async function createPendingOrder(data: PendingOrderData): Promise<Order | null> {
  const supabase = getAdminClient();
  
  // Generate unique Midtrans order ID
  const midtransOrderId = await generateUniqueMidtransOrderId();
  
  const orderData: OrderInsert = {
    voucher_id: null, // Will be set after payment success
    customer_email: data.customer_email,
    customer_name: data.customer_name,
    customer_phone: data.customer_phone,
    payment_method: "BANK_TRANSFER", // Default, will be updated by Midtrans
    payment_status: "PENDING",
    total_amount: data.total_amount,
    midtrans_order_id: midtransOrderId,
    // Store recipient info for voucher creation after payment
    service_id: data.service_id,
    recipient_name: data.recipient_name,
    recipient_email: data.recipient_email || null,
    recipient_phone: data.recipient_phone,
    sender_message: data.sender_message || null,
    delivery_method: data.delivery_method,
    send_to: data.send_to,
  };
  
  const { data: order, error } = await supabase
    .from("orders")
    .insert(orderData as Database["public"]["Tables"]["orders"]["Insert"])
    .select()
    .single();
  
  if (error) {
    console.error("Error creating pending order:", error);
    return null;
  }
  
  return order as Order;
}

/**
 * Get order by Midtrans order ID (for webhook processing)
 * @param midtransOrderId - The Midtrans order ID
 * @returns Order with service info or null if not found
 */
export async function getOrderByMidtransOrderId(midtransOrderId: string): Promise<OrderWithService | null> {
  const supabase = getAdminClient();
  
  const { data, error } = await supabase
    .from("orders")
    .select(`*, services(*)`)
    .eq("midtrans_order_id", midtransOrderId)
    .single();
  
  if (error) {
    console.error("Error fetching order by Midtrans ID:", error);
    return null;
  }
  
  return data as OrderWithService;
}

/**
 * Update order payment status and Midtrans data (for webhook processing)
 * @param orderId - The internal order ID (UUID)
 * @param status - New payment status
 * @param midtransData - Midtrans transaction data
 * @returns true if successful, false otherwise
 */
export async function updateOrderPaymentStatus(
  orderId: string,
  status: PaymentStatus,
  midtransData?: MidtransPaymentData
): Promise<boolean> {
  const supabase = getAdminClient();
  
  const updateData: Database["public"]["Tables"]["orders"]["Update"] = {
    payment_status: status,
  };
  
  // Add Midtrans data if provided
  if (midtransData) {
    updateData.midtrans_transaction_id = midtransData.transaction_id;
    updateData.midtrans_payment_type = midtransData.payment_type;
    updateData.midtrans_transaction_time = midtransData.transaction_time;
  }
  
  const { error } = await supabase
    .from("orders")
    .update(updateData)
    .eq("id", orderId);
  
  if (error) {
    console.error("Error updating order payment status:", error);
    return false;
  }
  
  revalidateTag("dashboard-stats", "max");
  return true;
}

/**
 * Update order with voucher ID after successful payment
 * @param orderId - The internal order ID (UUID)
 * @param voucherId - The created voucher ID
 * @returns true if successful, false otherwise
 */
export async function updateOrderVoucherId(
  orderId: string,
  voucherId: string
): Promise<boolean> {
  const supabase = getAdminClient();
  
  const { error } = await supabase
    .from("orders")
    .update({ voucher_id: voucherId })
    .eq("id", orderId);
  
  if (error) {
    console.error("Error updating order voucher ID:", error);
    return false;
  }
  
  return true;
}
