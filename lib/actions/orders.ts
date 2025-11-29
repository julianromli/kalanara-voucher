"use server";

import { createClient } from "@/lib/supabase/server";
import { getAdminClient } from "@/lib/supabase/admin";
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
