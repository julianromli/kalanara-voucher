"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { formatCurrency } from "@/lib/constants";
import { DashboardHeader } from "@/components/admin/dashboard-header";
import { StatCard } from "@/components/admin/stat-card";
import { ChartCard } from "@/components/admin/chart-card";
import { RecentOrders } from "@/components/admin/recent-orders";
import { VoucherSummary } from "@/components/admin/voucher-summary";
import { cn } from "@/lib/utils";
import type { DashboardStats } from "@/lib/actions/dashboard";

interface DashboardClientProps {
  stats: DashboardStats;
}

export function DashboardClient({ stats }: DashboardClientProps) {
  const router = useRouter();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push("/admin/login");
    }
  }, [authLoading, isAuthenticated, router]);

  useEffect(() => {
    const timer = setTimeout(() => setIsMounted(true), 100);
    return () => clearTimeout(timer);
  }, []);

  // Redirect while checking auth
  if (authLoading || !isAuthenticated) {
    return null;
  }

  const {
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
      <div className="w-full overflow-y-auto overflow-x-hidden p-4 md:p-6 h-full">
        <div className="mx-auto w-full space-y-6">
          {/* Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              title="Total Revenue"
              value={formatCurrency(totalRevenue)}
              icon="revenue"
              badge="All Time"
              animationDelay={0}
            />
            <StatCard
              title="Active Vouchers"
              value={activeVouchers}
              icon="active"
              badge="Current"
              animationDelay={75}
            />
            <StatCard
              title="Total Orders"
              value={totalOrders}
              icon="orders"
              badge="All Time"
              animationDelay={150}
            />
            <StatCard
              title="Avg. Rating"
              value={`${avgRating || "N/A"} / 5`}
              icon="rating"
              badge="Reviews"
              animationDelay={225}
            />
          </div>

          {/* Charts Row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <ChartCard data={revenueData} animationDelay={300} />
            <RecentOrders orders={recentOrders} animationDelay={375} />
          </div>

          {/* Bottom Row */}
          <div className={cn(
            "grid grid-cols-1 lg:grid-cols-3 gap-6",
            isMounted ? "animate-fade-slide-up" : "opacity-0"
          )} style={{ animationDelay: "450ms" }}>
            <div className="lg:col-span-2">
              {/* Quick Stats */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <StatCard
                  title="Services"
                  value={totalServices}
                  icon="services"
                  animationDelay={500}
                />
                <StatCard
                  title="Total Vouchers"
                  value={totalVouchers}
                  icon="vouchers"
                  animationDelay={575}
                />
                <StatCard
                  title="Redeemed"
                  value={redeemedVouchers}
                  icon="redeemed"
                  animationDelay={650}
                />
                <StatCard
                  title="Reviews"
                  value={totalReviews}
                  icon="rating"
                  animationDelay={725}
                />
              </div>
            </div>
            <VoucherSummary stats={voucherStats} reviews={recentReviews} animationDelay={500} />
          </div>
        </div>
      </div>
    </>
  );
}
