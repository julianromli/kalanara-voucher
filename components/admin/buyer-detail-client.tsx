"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { DashboardHeader } from "@/components/admin/dashboard-header";
import {
  AdminPageBody,
  AdminPageIntro,
  AdminSurface,
} from "@/components/admin/admin-page";
import { useAuth } from "@/context/AuthContext";
import type { AdminBuyer } from "@/lib/actions/buyers";
import { formatBuyerPhone } from "@/lib/admin/buyer-phone";
import { formatCurrency } from "@/lib/constants";
import { sortOrderItems } from "@/lib/orderItems";
import type { OrderWithVoucherItems } from "@/lib/database.types";
import { Badge } from "@/components/ui/badge";

interface BuyerDetailClientProps {
  buyer: AdminBuyer;
  orders: OrderWithVoucherItems[];
}

function voucherCodes(order: OrderWithVoucherItems) {
  const codes = sortOrderItems(order.order_items)
    .map((item) => item.vouchers?.code)
    .filter((code): code is string => Boolean(code));

  if (codes.length === 0 && order.vouchers?.code) {
    return [order.vouchers.code];
  }

  return codes;
}

export function BuyerDetailClient({ buyer, orders }: BuyerDetailClientProps) {
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

  return (
    <>
      <DashboardHeader title={buyer.customerName} showActions={false} />
      <AdminPageBody>
        <AdminPageIntro
          description={
            <>
              <Link href="/admin/buyers" className="underline-offset-4 hover:underline">
                Pembeli
              </Link>
              {" · "}
              {formatBuyerPhone(buyer.phone)}
              {" · "}
              {buyer.customerEmail}
            </>
          }
        />

        {buyer.otherNames.length > 0 ? (
          <p className="text-sm text-muted-foreground">
            Nama lain pada pembelian sebelumnya: {buyer.otherNames.join(", ")}
          </p>
        ) : null}

        <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
          <AdminSurface>
            <p className="text-sm text-muted-foreground">Pembelian</p>
            <p className="font-sans text-2xl font-semibold tabular-nums">{buyer.orderCount}</p>
          </AdminSurface>
          <AdminSurface>
            <p className="text-sm text-muted-foreground">Voucher</p>
            <p className="font-sans text-2xl font-semibold tabular-nums">{buyer.voucherCount}</p>
          </AdminSurface>
          <AdminSurface className="col-span-2 md:col-span-1">
            <p className="text-sm text-muted-foreground">Terakhir</p>
            <p className="font-sans text-lg font-semibold">
              {new Date(buyer.lastOrderAt).toLocaleDateString("id-ID", {
                day: "numeric",
                month: "short",
                year: "numeric",
              })}
            </p>
          </AdminSurface>
        </div>

        <div className="space-y-3">
          {orders.map((order) => {
            const codes = voucherCodes(order);
            return (
              <AdminSurface key={order.id}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <Link
                      href={`/admin/purchases?order=${order.id}`}
                      className="font-medium text-foreground hover:underline"
                    >
                      {order.payment_order_id || "Pembelian"}
                    </Link>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {new Date(order.created_at).toLocaleString("id-ID")}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-medium tabular-nums">{formatCurrency(order.total_amount)}</p>
                    <Badge variant="outline" className="mt-1">
                      {order.payment_status}
                    </Badge>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {codes.length === 0 ? (
                    <span className="text-sm text-muted-foreground">Voucher belum terbit</span>
                  ) : (
                    codes.map((code) => (
                      <Link
                        key={code}
                        href={`/admin/vouchers?query=${encodeURIComponent(code)}`}
                        className="rounded-full bg-muted px-2.5 py-1 font-mono text-xs text-foreground hover:bg-muted/70"
                      >
                        {code}
                      </Link>
                    ))
                  )}
                </div>
              </AdminSurface>
            );
          })}
        </div>
      </AdminPageBody>
    </>
  );
}
