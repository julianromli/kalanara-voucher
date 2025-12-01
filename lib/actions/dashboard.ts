"use server";

import { createClient } from "@/lib/supabase/server";

export interface DashboardStats {
  totalRevenue: number;
  activeVouchers: number;
  redeemedVouchers: number;
  expiredVouchers: number;
  totalOrders: number;
  totalServices: number;
  totalVouchers: number;
  totalReviews: number;
  avgRating: number;
  revenueData: {
    day: string;
    revenue: number;
    orders: number;
  }[];
  recentOrders: {
    id: string;
    customerName: string;
    serviceName: string;
    totalAmount: number;
    createdAt: string;
  }[];
  recentReviews: {
    id: string;
    rating: number;
    comment: string | null;
    customerName: string;
  }[];
}

export async function getDashboardStats(): Promise<DashboardStats> {
  const supabase = await createClient();

  // Parallel queries for better performance
  const [
    servicesResult,
    vouchersResult,
    ordersResult,
    reviewsResult,
  ] = await Promise.all([
    supabase.from("services").select("id", { count: "exact" }),
    supabase.from("vouchers").select("*, services(name, duration)"),
    supabase.from("orders").select("*, vouchers(*, services(name, duration))").order("created_at", { ascending: false }),
    supabase.from("reviews").select("*").order("created_at", { ascending: false }),
  ]);

  const services = servicesResult.data || [];
  const vouchers = vouchersResult.data || [];
  const orders = ordersResult.data || [];
  const reviews = reviewsResult.data || [];

  // Calculate voucher stats
  const now = new Date();
  const activeVouchers = vouchers.filter(
    (v) => !v.is_redeemed && new Date(v.expiry_date) > now
  ).length;
  const redeemedVouchers = vouchers.filter((v) => v.is_redeemed).length;
  const expiredVouchers = vouchers.filter(
    (v) => !v.is_redeemed && new Date(v.expiry_date) <= now
  ).length;

  // Calculate total revenue
  const totalRevenue = orders.reduce((sum, o) => sum + (o.total_amount || 0), 0);

  // Calculate average rating
  const avgRating =
    reviews.length > 0
      ? Math.round((reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length) * 10) / 10
      : 0;

  // Generate revenue data for last 7 days
  const revenueData = Array.from({ length: 7 }, (_, i) => {
    const date = new Date();
    date.setDate(date.getDate() - (6 - i));
    const dayOrders = orders.filter((o) => {
      const orderDate = new Date(o.created_at);
      return orderDate.toDateString() === date.toDateString();
    });
    return {
      day: date.toLocaleDateString("en-US", { weekday: "short" }),
      revenue: dayOrders.reduce((sum, o) => sum + (o.total_amount || 0), 0),
      orders: dayOrders.length,
    };
  });

  // Recent orders (top 5)
  const recentOrders = orders.slice(0, 5).map((order) => ({
    id: order.id,
    customerName: order.customer_name,
    serviceName: order.vouchers?.services?.name || "Service",
    totalAmount: order.total_amount,
    createdAt: order.created_at,
  }));

  // Recent reviews (top 3)
  const recentReviews = reviews.slice(0, 3).map((review) => ({
    id: review.id,
    rating: review.rating,
    comment: review.comment,
    customerName: review.customer_name,
  }));

  return {
    totalRevenue,
    activeVouchers,
    redeemedVouchers,
    expiredVouchers,
    totalOrders: orders.length,
    totalServices: servicesResult.count || services.length,
    totalVouchers: vouchers.length,
    totalReviews: reviews.length,
    avgRating,
    revenueData,
    recentOrders,
    recentReviews,
  };
}
