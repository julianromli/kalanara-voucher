"use server";

import { cacheLife, cacheTag } from "next/cache";
import {
  AdminPermission,
  hasPermissionForRole,
} from "@/lib/auth/admin-rbac";
import { requireAdminPermission } from "@/lib/auth/admin-rbac-server";
import type { Database } from "@/lib/database.types";
import { getAdminClient } from "@/lib/supabase/admin";

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

type DashboardAggregateRow =
  Database["public"]["Functions"]["get_admin_dashboard_aggregates"]["Returns"][number];

interface RecentOperationalOrderRow {
  id: string;
  customer_name: string;
  created_at: string;
  vouchers: {
    services: {
      name: string;
    } | null;
  } | null;
}

interface RecentBusinessOrderRow extends RecentOperationalOrderRow {
  total_amount: number;
}

interface RecentReviewRow {
  id: string;
  rating: number;
  comment: string | null;
  customer_name: string;
}

function getDayLabel(date: string) {
  return new Date(`${date}T00:00:00.000Z`).toLocaleDateString("en-US", {
    weekday: "short",
    timeZone: "UTC",
  });
}

export async function getDashboardStats(): Promise<DashboardStats> {
  "use cache: private";
  cacheLife("minutes");
  cacheTag("dashboard-stats");

  const access = await requireAdminPermission(
    AdminPermission.DASHBOARD_VIEW_OPERATIONAL,
  );
  const canViewBusinessMetrics = hasPermissionForRole(
    access.role,
    AdminPermission.DASHBOARD_VIEW_BUSINESS,
  );
  const canManageReviews = hasPermissionForRole(
    access.role,
    AdminPermission.REVIEWS_MANAGE,
  );

  const supabase = getAdminClient();
  const aggregatePromise = supabase.rpc("get_admin_dashboard_aggregates");
  const recentOrdersPromise = canViewBusinessMetrics
    ? supabase
        .from("orders")
        .select(
          "id, customer_name, total_amount, created_at, vouchers:vouchers!orders_voucher_id_fkey(services(name))",
        )
        .order("created_at", { ascending: false })
        .order("id", { ascending: false })
        .limit(5)
    : supabase
        .from("orders")
        .select(
          "id, customer_name, created_at, vouchers:vouchers!orders_voucher_id_fkey(services(name))",
        )
        .order("created_at", { ascending: false })
        .order("id", { ascending: false })
        .limit(5);
  const servicesPromise = canViewBusinessMetrics
    ? supabase.from("services").select("id", { count: "exact", head: true })
    : Promise.resolve({ data: null, count: 0, error: null });
  const reviewsPromise = canManageReviews
    ? supabase
        .from("reviews")
        .select("id, rating, comment, customer_name")
        .order("created_at", { ascending: false })
        .order("id", { ascending: false })
        .limit(3)
    : Promise.resolve({ data: [], error: null });

  const [aggregateResult, ordersResult, servicesResult, reviewsResult] =
    await Promise.all([
      aggregatePromise,
      recentOrdersPromise,
      servicesPromise,
      reviewsPromise,
    ]);

  if (aggregateResult.error) {
    console.error(
      "Error fetching dashboard aggregates:",
      aggregateResult.error,
    );
    throw aggregateResult.error;
  }
  if (ordersResult.error) {
    console.error("Error fetching recent dashboard orders:", ordersResult.error);
    throw ordersResult.error;
  }
  if (servicesResult.error) {
    console.error("Error counting dashboard services:", servicesResult.error);
    throw servicesResult.error;
  }
  if (reviewsResult.error) {
    console.error("Error fetching recent dashboard reviews:", reviewsResult.error);
    throw reviewsResult.error;
  }

  const aggregates = (aggregateResult.data ?? []) as DashboardAggregateRow[];
  if (aggregates.length !== 7) {
    throw new Error(
      `Dashboard aggregate RPC returned ${aggregates.length} rows; expected exactly 7.`,
    );
  }

  const totals = aggregates[0];
  const orders = (ordersResult.data ?? []) as RecentOperationalOrderRow[];
  const reviews = (reviewsResult.data ?? []) as RecentReviewRow[];

  return {
    canViewBusinessMetrics,
    canManageReviews,
    totalRevenue: canViewBusinessMetrics ? totals.total_revenue : 0,
    activeVouchers: totals.active_vouchers,
    redeemedVouchers: totals.redeemed_vouchers,
    expiredVouchers: totals.expired_vouchers,
    totalOrders: totals.total_orders,
    totalServices: canViewBusinessMetrics ? (servicesResult.count ?? 0) : 0,
    totalVouchers: totals.total_vouchers,
    totalReviews: canManageReviews ? totals.total_reviews : 0,
    avgRating: canManageReviews ? totals.average_rating : 0,
    revenueData: canViewBusinessMetrics
      ? aggregates.map((row) => ({
          day: getDayLabel(row.bucket_date),
          revenue: row.bucket_revenue,
          orders: row.bucket_orders,
        }))
      : [],
    recentOrders: orders.map((order) => ({
      id: order.id,
      customerName: order.customer_name,
      serviceName: order.vouchers?.services?.name || "Service",
      totalAmount: canViewBusinessMetrics
        ? (order as RecentBusinessOrderRow).total_amount
        : null,
      createdAt: order.created_at,
    })),
    recentReviews: canManageReviews
      ? reviews.map((review) => ({
          id: review.id,
          rating: review.rating,
          comment: review.comment,
          customerName: review.customer_name,
        }))
      : [],
  };
}
