"use client";

import { useMemo, useState } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { Search01Icon, ShoppingBag01Icon, Calendar01Icon } from "@hugeicons/core-free-icons";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { formatCurrency, APP_CONFIG } from "@/lib/constants";

interface Order {
  id: string;
  customerName: string;
  serviceName: string;
  totalAmount: number | null;
  createdAt: string;
}

interface RecentOrdersProps {
  orders: Order[];
  animationDelay?: number;
}

export function RecentOrders({ orders }: RecentOrdersProps) {
  const [query, setQuery] = useState("");
  const filteredOrders = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) {
      return orders;
    }

    return orders.filter((order) =>
      [order.customerName, order.serviceName]
        .join(" ")
        .toLowerCase()
        .includes(normalized),
    );
  }, [orders, query]);

  return (
    <div className="admin-surface flex h-[400px] flex-col overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 pt-4 pb-4">
        <div className="flex items-center gap-2">
          <HugeiconsIcon
            icon={ShoppingBag01Icon}
            className="size-4 text-muted-foreground"
          />
          <h2 className="text-[15px] font-medium tracking-tight text-foreground">
            Pembelian Terbaru
          </h2>
        </div>

        <div className="relative">
          <label htmlFor="recent-orders-search" className="sr-only">
            Cari pembelian terbaru
          </label>
          <HugeiconsIcon
            icon={Search01Icon}
            className="pointer-events-none absolute top-1/2 left-2 z-10 size-4 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            id="recent-orders-search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Cari pembelian..."
            className="h-7 w-[140px] pl-8 pr-2 text-sm sm:w-[180px] md:w-[200px]"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-4">
        <div className="space-y-2">
          {filteredOrders.length === 0 ? (
            <div className="py-10 text-center text-sm text-muted-foreground">
              {orders.length === 0
                ? "Belum ada pembelian"
                : "Tidak ada pembelian yang cocok"}
            </div>
          ) : (
            filteredOrders.map((order) => (
              <div
                key={order.id}
                className="relative h-14 rounded-lg border border-border bg-sidebar px-3 py-2 row-hover-lift"
              >
                <div className="flex h-full items-center justify-between gap-3">
                  <div className="flex min-w-0 flex-1 items-center gap-3">
                    <Avatar className="size-8 shrink-0">
                      <AvatarImage
                        src={APP_CONFIG.defaultAvatarUrl}
                        alt={order.customerName}
                      />
                      <AvatarFallback className="bg-muted text-xs text-muted-foreground">
                        {order.customerName.charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-foreground">
                        {order.customerName}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {order.serviceName}
                      </p>
                    </div>
                  </div>

                  <div className="shrink-0 text-right">
                    <p className="text-sm font-medium text-foreground tabular-nums">
                      {order.totalAmount === null
                        ? "-"
                        : formatCurrency(order.totalAmount)}
                    </p>
                    <div className="flex items-center justify-end gap-1 text-xs text-muted-foreground">
                      <HugeiconsIcon icon={Calendar01Icon} className="size-3" />
                      {new Date(order.createdAt).toLocaleDateString("id-ID", {
                        month: "short",
                        day: "numeric",
                      })}
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
