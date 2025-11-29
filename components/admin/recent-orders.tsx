"use client";

import { useEffect, useState } from "react";
import { Search, ShoppingBag, Calendar } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { formatCurrency } from "@/lib/constants";
import { cn } from "@/lib/utils";

interface Order {
  id: string;
  customerName: string;
  serviceName: string;
  totalAmount: number;
  createdAt: string;
}

interface RecentOrdersProps {
  orders: Order[];
  animationDelay?: number;
}

export function RecentOrders({ orders, animationDelay = 0 }: RecentOrdersProps) {
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setIsMounted(true), 50);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div 
      className={cn(
        "relative overflow-hidden rounded-xl border border-border bg-card max-h-[400px] flex flex-col",
        isMounted ? "animate-scale-in" : "opacity-0"
      )}
      style={{ animationDelay: `${animationDelay}ms` }}
    >
      <div className="flex items-center justify-between px-4 pt-[15px] pb-4 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <ShoppingBag className="size-4 text-muted-foreground" />
          <h2 className="text-[15px] font-normal text-foreground tracking-tight">
            Recent Orders
          </h2>
        </div>

        <div className="relative">
          <Search className="absolute left-2 top-1/2 size-4 -translate-y-1/2 text-muted-foreground z-10" />
          <Input
            placeholder="Search orders..."
            className="h-7 w-[140px] sm:w-[180px] md:w-[200px] pl-8 pr-2 text-sm text-muted-foreground"
          />
        </div>
      </div>

      <div className="px-[14px] pb-4 overflow-y-auto flex-1">
        <div className="space-y-[8px]">
          {orders.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground text-sm">
              No orders yet
            </div>
          ) : (
            orders.map((order, index) => (
              <div
                key={order.id}
                className={cn(
                  "relative h-[56px] rounded-[10px] border border-border bg-sidebar hover:bg-sidebar-accent px-3 py-2 row-hover-lift",
                  isMounted ? "animate-fade-slide-up" : "opacity-0"
                )}
                style={{ animationDelay: `${animationDelay + 100 + index * 75}ms` }}
              >
                <div className="flex items-center justify-between h-full gap-3">
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <Avatar className="size-8 shrink-0">
                      <AvatarFallback className="bg-muted text-muted-foreground text-xs">
                        {order.customerName.charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-foreground truncate">
                        {order.customerName}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        {order.serviceName}
                      </p>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <p className="text-sm font-medium text-foreground">
                      {formatCurrency(order.totalAmount)}
                    </p>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Calendar className="size-3" />
                      {new Date(order.createdAt).toLocaleDateString("en-US", {
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

      <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-card to-transparent rounded-b-xl" />
    </div>
  );
}
