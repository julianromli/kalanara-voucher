"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getBuyerOrders } from "@/lib/actions/buyers";
import { formatCurrency } from "@/lib/constants";
import type { OrderWithVoucherItems } from "@/lib/database.types";
import { formatMemberDate } from "@/lib/membership/format";
import { sortOrderItems } from "@/lib/orderItems";

interface MemberPurchaseHistoryProps {
  phone: string;
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

export function MemberPurchaseHistory({ phone }: MemberPurchaseHistoryProps) {
  const [orders, setOrders] = useState<OrderWithVoucherItems[] | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void getBuyerOrders(phone)
      .then((rows) => {
        if (cancelled) return;
        setOrders(rows);
      })
      .catch(() => {
        if (cancelled) return;
        setError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [phone]);

  return (
    <section>
      <h3 className="mb-2 text-sm font-medium">Riwayat beli voucher</h3>
      {error ? (
        <p className="text-sm text-muted-foreground">Riwayat pembelian gagal dimuat.</p>
      ) : orders == null ? (
        <p className="text-sm text-muted-foreground">Memuat riwayat pembelian…</p>
      ) : orders.length === 0 ? (
        <p className="text-sm text-muted-foreground">Belum pernah beli voucher online.</p>
      ) : (
        <ul>
          {orders.map((order) => {
            const codes = voucherCodes(order);
            return (
              <li key={order.id} className="flex items-start justify-between gap-3 py-2 text-sm">
                <div className="min-w-0">
                  <Link
                    href={`/admin/purchases?order=${order.id}`}
                    className="font-medium text-foreground hover:underline"
                  >
                    {order.payment_order_id || "Pembelian"}
                  </Link>
                  <p className="text-xs text-muted-foreground">
                    {formatMemberDate(order.created_at)}
                    {codes.length > 0 ? ` · ${codes.join(", ")}` : ""}
                  </p>
                </div>
                <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                  {formatCurrency(order.total_amount)}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
