"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  LayoutDashboard,
  Tag,
  ShoppingBag,
  Star,
  TrendingUp,
  CheckCircle,
  Clock,
  XCircle,
  Ticket,
  ArrowRight,
  Loader2,
} from "lucide-react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { useAuth } from "@/context/AuthContext";
import { useStore } from "@/context/StoreContext";
import { formatCurrency } from "@/lib/constants";
import { Button } from "@/components/ui/button";

const CHART_COLORS = ["#778c5d", "#b39474", "#94a67a", "#c2aa8e"];

export default function AdminDashboardPage() {
  const router = useRouter();
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const { services, vouchers, orders, reviews, isLoading: dataLoading } = useStore();

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push("/admin/login");
    }
  }, [authLoading, isAuthenticated, router]);

  if (authLoading || !isAuthenticated) {
    return (
      <div className="min-h-screen bg-sage-900 flex items-center justify-center">
        <Loader2 className="animate-spin text-sand-300" size={32} />
      </div>
    );
  }

  // Stats
  const totalRevenue = orders.reduce((sum, o) => sum + o.totalAmount, 0);
  const activeVouchers = vouchers.filter((v) => !v.isRedeemed && new Date(v.expiryDate) > new Date()).length;
  const redeemedVouchers = vouchers.filter((v) => v.isRedeemed).length;
  const expiredVouchers = vouchers.filter((v) => !v.isRedeemed && new Date(v.expiryDate) <= new Date()).length;
  const avgRating =
    reviews.length > 0
      ? (reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length).toFixed(1)
      : "N/A";

  const recentOrders = orders.slice(0, 5);

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

  // Voucher status pie chart data
  const voucherPieData = [
    { name: "Active", value: activeVouchers, color: "#778c5d" },
    { name: "Redeemed", value: redeemedVouchers, color: "#5d7048" },
    { name: "Expired", value: expiredVouchers, color: "#dc2626" },
  ].filter((d) => d.value > 0);

  // Service category distribution
  const categoryData = services.reduce((acc, service) => {
    const existing = acc.find((c) => c.name === service.category);
    if (existing) {
      existing.value += 1;
    } else {
      acc.push({ name: service.category || "Other", value: 1 });
    }
    return acc;
  }, [] as { name: string; value: number }[]);

  return (
    <div className="min-h-screen bg-sage-50">
      {/* Header */}
      <div className="bg-sage-900 py-8 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center gap-3 mb-2">
            <LayoutDashboard size={24} className="text-sand-400" />
            <h1 className="font-serif text-2xl text-sand-100">Dashboard</h1>
          </div>
          <p className="text-sage-400">
            Welcome back, {user?.name}. Here&apos;s your overview.
          </p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-white p-6 rounded-2xl shadow-spa border border-sage-100">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-emerald-100 rounded-xl flex items-center justify-center">
                <TrendingUp size={24} className="text-emerald-600" />
              </div>
              <span className="text-xs text-sage-500 bg-sage-100 px-2 py-1 rounded">
                All Time
              </span>
            </div>
            <p className="text-sm text-sage-500 mb-1">Total Revenue</p>
            <p className="font-serif text-2xl text-sage-900">
              {formatCurrency(totalRevenue)}
            </p>
          </div>

          <div className="bg-white p-6 rounded-2xl shadow-spa border border-sage-100">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                <Tag size={24} className="text-blue-600" />
              </div>
              <span className="text-xs text-sage-500 bg-sage-100 px-2 py-1 rounded">
                Active
              </span>
            </div>
            <p className="text-sm text-sage-500 mb-1">Active Vouchers</p>
            <p className="font-serif text-2xl text-sage-900">{activeVouchers}</p>
          </div>

          <div className="bg-white p-6 rounded-2xl shadow-spa border border-sage-100">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center">
                <ShoppingBag size={24} className="text-purple-600" />
              </div>
              <span className="text-xs text-sage-500 bg-sage-100 px-2 py-1 rounded">
                Total
              </span>
            </div>
            <p className="text-sm text-sage-500 mb-1">Total Orders</p>
            <p className="font-serif text-2xl text-sage-900">{orders.length}</p>
          </div>

          <div className="bg-white p-6 rounded-2xl shadow-spa border border-sage-100">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-amber-100 rounded-xl flex items-center justify-center">
                <Star size={24} className="text-amber-600" />
              </div>
              <span className="text-xs text-sage-500 bg-sage-100 px-2 py-1 rounded">
                Average
              </span>
            </div>
            <p className="text-sm text-sage-500 mb-1">Customer Rating</p>
            <p className="font-serif text-2xl text-sage-900">{avgRating} / 5</p>
          </div>
        </div>

        {/* Quick Links */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
          <Link href="/admin/services">
            <div className="bg-white p-4 rounded-xl shadow-spa border border-sage-100 flex items-center justify-between hover:shadow-spa-lg transition-shadow cursor-pointer group">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-sage-100 rounded-lg flex items-center justify-center">
                  <Tag size={20} className="text-sage-600" />
                </div>
                <div>
                  <p className="font-medium text-sage-900">Manage Services</p>
                  <p className="text-sm text-sage-500">{services.length} services</p>
                </div>
              </div>
              <ArrowRight size={20} className="text-sage-400 group-hover:text-sage-600 transition-colors" />
            </div>
          </Link>
          <Link href="/admin/vouchers">
            <div className="bg-white p-4 rounded-xl shadow-spa border border-sage-100 flex items-center justify-between hover:shadow-spa-lg transition-shadow cursor-pointer group">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-sage-100 rounded-lg flex items-center justify-center">
                  <Ticket size={20} className="text-sage-600" />
                </div>
                <div>
                  <p className="font-medium text-sage-900">Manage Vouchers</p>
                  <p className="text-sm text-sage-500">{vouchers.length} vouchers</p>
                </div>
              </div>
              <ArrowRight size={20} className="text-sage-400 group-hover:text-sage-600 transition-colors" />
            </div>
          </Link>
        </div>

        {/* Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          {/* Revenue Chart */}
          <div className="bg-white rounded-2xl shadow-spa border border-sage-100 p-6">
            <h3 className="font-semibold text-sage-900 mb-4 flex items-center gap-2">
              <TrendingUp size={18} /> Revenue (Last 7 Days)
            </h3>
            <div className="h-[250px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={revenueData}>
                  <defs>
                    <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#778c5d" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#778c5d" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e8ebe3" />
                  <XAxis dataKey="day" tick={{ fontSize: 12, fill: "#5d4a3b" }} />
                  <YAxis tick={{ fontSize: 12, fill: "#5d4a3b" }} tickFormatter={(v) => `${(v / 1000000).toFixed(1)}M`} />
                  <Tooltip
                    formatter={(value: number) => [formatCurrency(value), "Revenue"]}
                    contentStyle={{ borderRadius: 8, border: "1px solid #d2d9c8" }}
                  />
                  <Area type="monotone" dataKey="revenue" stroke="#778c5d" strokeWidth={2} fill="url(#colorRevenue)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Voucher Status Pie */}
          <div className="bg-white rounded-2xl shadow-spa border border-sage-100 p-6">
            <h3 className="font-semibold text-sage-900 mb-4 flex items-center gap-2">
              <Ticket size={18} /> Voucher Status
            </h3>
            <div className="h-[250px] flex items-center">
              {voucherPieData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={voucherPieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={90}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {voucherPieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value: number, name: string) => [value, name]}
                      contentStyle={{ borderRadius: 8, border: "1px solid #d2d9c8" }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="w-full text-center text-sage-500">No voucher data</div>
              )}
              <div className="space-y-2">
                {voucherPieData.map((item) => (
                  <div key={item.name} className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                    <span className="text-sm text-sage-600">{item.name}: {item.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Recent Orders */}
          <div className="lg:col-span-2 bg-white rounded-2xl shadow-spa border border-sage-100 overflow-hidden">
            <div className="p-6 border-b border-sage-100">
              <h2 className="font-semibold text-sage-900 flex items-center gap-2">
                <ShoppingBag size={20} /> Recent Orders
              </h2>
            </div>
            <div className="divide-y divide-sage-100">
              {recentOrders.length > 0 ? (
                recentOrders.map((order) => (
                  <div
                    key={order.id}
                    className="p-4 hover:bg-sage-50 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-sage-900">
                          {order.customerName}
                        </p>
                        <p className="text-sm text-sage-500">
                          {order.voucher?.service?.name || "Service"}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold text-sage-900">
                          {formatCurrency(order.totalAmount)}
                        </p>
                        <p className="text-xs text-sage-400">
                          {new Date(order.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="p-8 text-center text-sage-500">
                  No orders yet
                </div>
              )}
            </div>
          </div>

          {/* Quick Stats */}
          <div className="space-y-6">
            {/* Voucher Stats */}
            <div className="bg-white rounded-2xl shadow-spa border border-sage-100 p-6">
              <h3 className="font-semibold text-sage-900 mb-4 flex items-center gap-2">
                <Ticket size={18} /> Voucher Summary
              </h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sage-600 flex items-center gap-2">
                    <Clock size={14} className="text-emerald-500" /> Active
                  </span>
                  <span className="font-semibold text-sage-900">
                    {activeVouchers}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sage-600 flex items-center gap-2">
                    <CheckCircle size={14} className="text-blue-500" /> Redeemed
                  </span>
                  <span className="font-semibold text-sage-900">
                    {redeemedVouchers}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sage-600 flex items-center gap-2">
                    <XCircle size={14} className="text-red-500" /> Expired
                  </span>
                  <span className="font-semibold text-sage-900">
                    {expiredVouchers}
                  </span>
                </div>
              </div>
            </div>

            {/* Recent Reviews */}
            <div className="bg-white rounded-2xl shadow-spa border border-sage-100 p-6">
              <h3 className="font-semibold text-sage-900 mb-4 flex items-center gap-2">
                <Star size={18} /> Recent Reviews
              </h3>
              {reviews.length > 0 ? (
                <div className="space-y-3">
                  {reviews.slice(0, 3).map((review) => (
                    <div
                      key={review.id}
                      className="text-sm border-l-2 border-sage-200 pl-3"
                    >
                      <div className="flex items-center gap-1 mb-1">
                        {[...Array(5)].map((_, i) => (
                          <Star
                            key={i}
                            size={12}
                            className={
                              i < review.rating
                                ? "text-amber-500 fill-amber-500"
                                : "text-gray-300"
                            }
                          />
                        ))}
                      </div>
                      <p className="text-sage-700 line-clamp-1">
                        {review.comment || "No comment"}
                      </p>
                      <p className="text-sage-400 text-xs mt-1">
                        {review.customerName}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sage-500 text-sm">No reviews yet</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
