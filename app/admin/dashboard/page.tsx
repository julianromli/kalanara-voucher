"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useStore } from "@/context/StoreContext";
import { formatCurrency } from "@/lib/constants";
import { DashboardHeader } from "@/components/admin/dashboard-header";
import { StatCard } from "@/components/admin/stat-card";
import { ChartCard } from "@/components/admin/chart-card";
import { RecentOrders } from "@/components/admin/recent-orders";
import { VoucherSummary } from "@/components/admin/voucher-summary";

export default function AdminDashboardPage() {
  const router = useRouter();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const { services, vouchers, orders, reviews, isLoading: dataLoading } = useStore();

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push("/admin/login");
    }
  }, [authLoading, isAuthenticated, router]);

  // Show loading while auth or data is loading
  if (authLoading || dataLoading || !isAuthenticated) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="animate-spin text-muted-foreground" size={32} />
      </div>
    );
  }

  // Stats calculations
  const totalRevenue = orders.reduce((sum, o) => sum + o.totalAmount, 0);
  const activeVouchers = vouchers.filter((v) => !v.isRedeemed && new Date(v.expiryDate) > new Date()).length;
  const redeemedVouchers = vouchers.filter((v) => v.isRedeemed).length;
  const expiredVouchers = vouchers.filter((v) => !v.isRedeemed && new Date(v.expiryDate) <= new Date()).length;
  const avgRating =
    reviews.length > 0
      ? (reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length).toFixed(1)
      : "N/A";

  // Generate revenue data for chart (last 7 days)
  const revenueData = Array.from({ length: 7 }, (_, i) => {
    const date = new Date();
    date.setDate(date.getDate() - (6 - i));
    const dayOrders = orders.filter((o) => {
      const orderDate = new Date(o.createdAt);
      return orderDate.toDateString() === date.toDateString();
    });
    return {
      day: date.toLocaleDateString("en-US", { weekday: "short" }),
      revenue: dayOrders.reduce((sum, o) => sum + o.totalAmount, 0),
      orders: dayOrders.length,
    };
  });

  // Recent orders for display
  const recentOrdersData = orders.slice(0, 5).map((order) => ({
    id: order.id,
    customerName: order.customerName,
    serviceName: order.voucher?.service?.name || "Service",
    totalAmount: order.totalAmount,
    createdAt: typeof order.createdAt === 'string' ? order.createdAt : order.createdAt.toISOString(),
  }));

  // Voucher stats
  const voucherStats = {
    active: activeVouchers,
    redeemed: redeemedVouchers,
    expired: expiredVouchers,
  };

  // Reviews for display
  const reviewsData = reviews.slice(0, 3).map((review) => ({
    id: review.id,
    rating: review.rating,
    comment: review.comment,
    customerName: review.customerName,
  }));

  return (
    <>
      <DashboardHeader />
      <div className="w-full overflow-y-auto overflow-x-hidden p-4 md:p-6 h-full">
        <div className="mx-auto w-full space-y-6">
          {/* Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              title="Total Revenue"
              value={formatCurrency(totalRevenue)}
              icon="revenue"
              badge="All Time"
            />
            <StatCard
              title="Active Vouchers"
              value={activeVouchers}
              icon="active"
              badge="Current"
            />
            <StatCard
              title="Total Orders"
              value={orders.length}
              icon="orders"
              badge="All Time"
            />
            <StatCard
              title="Avg. Rating"
              value={`${avgRating} / 5`}
              icon="rating"
              badge="Reviews"
            />
          </div>

          {/* Charts Row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <ChartCard data={revenueData} />
            <RecentOrders orders={recentOrdersData} />
          </div>

          {/* Bottom Row */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              {/* Quick Stats */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <StatCard
                  title="Services"
                  value={services.length}
                  icon="services"
                />
                <StatCard
                  title="Total Vouchers"
                  value={vouchers.length}
                  icon="vouchers"
                />
                <StatCard
                  title="Redeemed"
                  value={redeemedVouchers}
                  icon="redeemed"
                />
                <StatCard
                  title="Reviews"
                  value={reviews.length}
                  icon="rating"
                />
              </div>
            </div>
            <VoucherSummary stats={voucherStats} reviews={reviewsData} />
          </div>
        </div>
      </div>
    </>
  );
}
