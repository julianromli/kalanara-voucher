"use server";

import {
  AdminPermission,
  hasPermissionForRole,
} from "@/lib/auth/admin-rbac";
import { requireAdminPermission } from "@/lib/auth/admin-rbac-server";
import { getAdminClient } from "@/lib/supabase/admin";
import { cacheLife, cacheTag } from "next/cache";

export interface DashboardStats {
  canViewBusinessMetrics: boolean;
  canManageReviews: boolean;
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
    totalAmount: number | null;
    createdAt: string;
  }[];
  recentReviews: {
    id: string;
    rating: number;
    comment: string | null;
    customerName: string;
  }[];
}

interface OperationalOrderRow {
  id: string;
  customer_name: string;
  created_at: string;
  payment_status: string;
  vouchers: {
    services: {
      name: string;
      duration: number;
    } | null;
  } | null;
}

interface BusinessOrderRow extends OperationalOrderRow {
  total_amount: number | null;
}

export async function getDashboardStats(): Promise<DashboardStats> {
  "use cache: private";
  cacheLife("minutes");
  cacheTag("dashboard-stats");

  const access = await requireAdminPermission(
    AdminPermission.DASHBOARD_VIEW_OPERATIONAL
  );
  const canViewBusinessMetrics = hasPermissionForRole(
    access.role,
    AdminPermission.DASHBOARD_VIEW_BUSINESS
  );
  const canManageReviews = hasPermissionForRole(
    access.role,
    AdminPermission.REVIEWS_MANAGE
  );

  const supabase = getAdminClient();
  const ordersPromise = canViewBusinessMetrics
    ? supabase
        .from("orders")
        .select(
          "id, customer_name, total_amount, created_at, payment_status, vouchers:vouchers!orders_voucher_id_fkey(services(name, duration))"
        )
        .order("created_at", { ascending: false })
    : supabase
        .from("orders")
        .select(
          "id, customer_name, created_at, payment_status, vouchers:vouchers!orders_voucher_id_fkey(services(name, duration))"
        )
        .order("created_at", { ascending: false });
  const servicesPromise = canViewBusinessMetrics
    ? supabase.from("services").select("id", { count: "exact" })
    : Promise.resolve({ data: [], count: 0, error: null });
  const reviewsPromise = canManageReviews
    ? supabase.from("reviews").select("*").order("created_at", { ascending: false })
    : Promise.resolve({ data: [], error: null });

  // Parallel queries for better performance
  const [
    servicesResult,
    vouchersResult,
    ordersResult,
    reviewsResult,
  ] = await Promise.all([
    servicesPromise,
    supabase.from("vouchers").select("*, services(name, duration)"),
    ordersPromise,
    reviewsPromise,
  ]);

  const services = servicesResult.data || [];
  const vouchers = vouchersResult.data || [];
  const orders = (ordersResult.data || []) as OperationalOrderRow[];
  const businessOrders = canViewBusinessMetrics ? (orders as BusinessOrderRow[]) : [];
  const completedBusinessOrders = businessOrders.filter(
    (order) => order.payment_status === "COMPLETED"
  );
  const reviews = reviewsResult.data || [];
  const businessOrderAmounts = new Map(
    businessOrders.map((order) => [order.id, order.total_amount ?? 0])
  );

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
  const totalRevenue = canViewBusinessMetrics
    ? completedBusinessOrders.reduce((sum, order) => sum + (order.total_amount || 0), 0)
    : 0;

  // Calculate average rating
  const avgRating =
    reviews.length > 0
      ? Math.round((reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length) * 10) / 10
      : 0;

  // Generate revenue data for last 7 days
  const revenueData = canViewBusinessMetrics
    ? Array.from({ length: 7 }, (_, i) => {
        const date = new Date();
        date.setDate(date.getDate() - (6 - i));
        const dayOrders = completedBusinessOrders.filter((order) => {
          const orderDate = new Date(order.created_at);
          return orderDate.toDateString() === date.toDateString();
        });
        return {
          day: date.toLocaleDateString("en-US", { weekday: "short" }),
          revenue: dayOrders.reduce(
            (sum, order) => sum + (order.total_amount || 0),
            0
          ),
          orders: dayOrders.length,
        };
      })
    : [];

  // Recent orders (top 5)
  const recentOrders = orders.slice(0, 5).map((order) => ({
    id: order.id,
    customerName: order.customer_name,
    serviceName: order.vouchers?.services?.name || "Service",
    totalAmount: canViewBusinessMetrics ? (businessOrderAmounts.get(order.id) ?? 0) : null,
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
    canViewBusinessMetrics,
    canManageReviews,
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
