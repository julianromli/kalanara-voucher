"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { DashboardHeader } from "@/components/admin/dashboard-header";
import {
  AdminPageBody,
  AdminSurface,
} from "@/components/admin/admin-page";
import { useAuth } from "@/context/AuthContext";
import type { AdminBuyer } from "@/lib/actions/buyers";
import { formatBuyerPhone } from "@/lib/admin/buyer-phone";
import { formatCurrency } from "@/lib/constants";
import { sortOrderItems } from "@/lib/orderItems";
import type { OrderWithVoucherItems } from "@/lib/database.types";
import { formatMemberDate } from "@/lib/membership/format";
import { whatsAppLink } from "@/lib/membership/templates";
import { MemberBadge } from "@/components/admin/member-badge";
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

  const waHref = whatsAppLink(
    buyer.phone,
    `Halo ${buyer.customerName.split(" ")[0] || buyer.customerName}`,
  );

  return (
    <>
      <DashboardHeader
        title={buyer.customerName}
        showActions={false}
        titleSlot={buyer.member ? <MemberBadge member={buyer.member} /> : null}
      />
      <AdminPageBody>
        <p className="text-sm text-muted-foreground">
          <Link href="/admin/buyers" className="underline-offset-4 hover:underline">
            Pembeli
          </Link>
        </p>

        <AdminSurface>
          <dl className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="min-w-0">
              <dt className="text-xs text-muted-foreground">WhatsApp</dt>
              <dd className="mt-0.5 text-sm text-pretty text-foreground">
                {waHref ? (
                  <a
                    href={waHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`Buka WhatsApp ${formatBuyerPhone(buyer.phone)}`}
                    className="underline underline-offset-4"
                  >
                    {formatBuyerPhone(buyer.phone)}
                  </a>
                ) : (
                  formatBuyerPhone(buyer.phone)
                )}
              </dd>
            </div>
            <div className="min-w-0">
              <dt className="text-xs text-muted-foreground">Email</dt>
              <dd className="mt-0.5 text-sm text-pretty text-foreground">{buyer.customerEmail}</dd>
            </div>
            <div className="min-w-0">
              <dt className="text-xs text-muted-foreground">Terakhir</dt>
              <dd className="mt-0.5 text-sm text-foreground">{formatMemberDate(buyer.lastOrderAt)}</dd>
            </div>
          </dl>
          <div className="mt-4 flex flex-wrap gap-x-8 gap-y-3 border-t border-border pt-4">
            <div>
              <p className="text-xs text-muted-foreground">Pembelian</p>
              <p className="font-sans text-xl font-semibold tabular-nums">{buyer.orderCount}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Voucher</p>
              <p className="font-sans text-xl font-semibold tabular-nums">{buyer.voucherCount}</p>
            </div>
          </div>
        </AdminSurface>

        {buyer.otherNames.length > 0 ? (
          <p className="text-sm text-muted-foreground">
            Nama lain pada pembelian sebelumnya: {buyer.otherNames.join(", ")}
          </p>
        ) : null}


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
