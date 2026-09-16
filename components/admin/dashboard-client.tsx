"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { formatCurrency } from "@/lib/constants";
import { DashboardHeader } from "@/components/admin/dashboard-header";
import { StatCard } from "@/components/admin/stat-card";
import { ChartCard } from "@/components/admin/chart-card";
import { RecentOrders } from "@/components/admin/recent-orders";
import { VoucherSummary } from "@/components/admin/voucher-summary";
import { AdminPageBody } from "@/components/admin/admin-page";
import { cn } from "@/lib/utils";
import type { DashboardStats } from "@/lib/actions/dashboard";

interface DashboardClientProps {
  stats: DashboardStats;
}

export function DashboardClient({ stats }: DashboardClientProps) {
  const router = useRouter();
  const { isAuthenticated, isLoading: authLoading } = useAuth();

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push("/admin/login");
    }
  }, [authLoading, isAuthenticated, router]);

  if (!isAuthenticated && !authLoading) {
    return null;
  }

  const {
    canManageReviews,
    canViewBusinessMetrics,
    totalRevenue,
    activeVouchers,
    redeemedVouchers,
    expiredVouchers,
    totalOrders,
    totalServices,
    totalVouchers,
    totalReviews,
    avgRating,
    revenueData,
    recentOrders,
    recentReviews,
  } = stats;

  const voucherStats = {
    active: activeVouchers,
    redeemed: redeemedVouchers,
    expired: expiredVouchers,
  };

  return (
    <>
      <DashboardHeader />
      <AdminPageBody>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
          {canViewBusinessMetrics ? (
            <StatCard
              title="Total Revenue"
              value={formatCurrency(totalRevenue)}
              icon="revenue"
              badge="All Time"
            />
          ) : null}
          <StatCard
            title="Active Vouchers"
            value={activeVouchers}
            icon="active"
            badge={canViewBusinessMetrics ? "Current" : "Operational"}
          />
          <StatCard
            title="Total Orders"
            value={totalOrders}
            icon="orders"
            badge={canViewBusinessMetrics ? "All Time" : "Read Only"}
          />
          {canViewBusinessMetrics ? (
            <StatCard
              title="Avg. Rating"
              value={`${avgRating || "N/A"} / 5`}
              icon="rating"
              badge="Reviews"
            />
          ) : (
            <>
              <StatCard
                title="Total Vouchers"
                value={totalVouchers}
                icon="vouchers"
                badge="All Time"
              />
              <StatCard
                title="Redeemed"
                value={redeemedVouchers}
                icon="redeemed"
                badge="All Time"
              />
            </>
          )}
        </div>

        <div
          className={cn(
            "grid grid-cols-1 gap-6",
            canViewBusinessMetrics ? "lg:grid-cols-2" : "",
          )}
        >
          {canViewBusinessMetrics ? <ChartCard data={revenueData} /> : null}
          <RecentOrders orders={recentOrders} />
        </div>

        <div
          className={cn(
            "grid grid-cols-1 gap-6",
            canViewBusinessMetrics ? "lg:grid-cols-3" : "lg:grid-cols-2",
          )}
        >
          <div className={canViewBusinessMetrics ? "lg:col-span-2" : undefined}>
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
              {canViewBusinessMetrics ? (
                <StatCard
                  title="Services"
                  value={totalServices}
                  icon="services"
                />
              ) : null}
              <StatCard
                title="Total Vouchers"
                value={totalVouchers}
                icon="vouchers"
              />
              <StatCard
                title="Redeemed"
                value={redeemedVouchers}
                icon="redeemed"
              />
              {canViewBusinessMetrics ? (
                <StatCard
                  title="Reviews"
                  value={totalReviews}
                  icon="rating"
                />
              ) : (
                <StatCard
                  title="Expired"
                  value={expiredVouchers}
                  icon="expired"
                />
              )}
            </div>
          </div>
          <VoucherSummary
            stats={voucherStats}
            reviews={recentReviews}
            showReviews={canManageReviews}
          />
        </div>
      </AdminPageBody>
    </>
  );
}
