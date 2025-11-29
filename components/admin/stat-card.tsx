"use client";

import { TrendingUp, Tag, ShoppingBag, Star, Ticket, Clock, CheckCircle, XCircle, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

const iconMap: Record<string, LucideIcon> = {
  revenue: TrendingUp,
  services: Tag,
  orders: ShoppingBag,
  rating: Star,
  vouchers: Ticket,
  active: Clock,
  redeemed: CheckCircle,
  expired: XCircle,
};

interface StatCardProps {
  title: string;
  value: string | number;
  icon: keyof typeof iconMap;
  badge?: string;
  className?: string;
}

export function StatCard({ title, value, icon, badge, className }: StatCardProps) {
  const Icon = iconMap[icon] || Tag;

  return (
    <div className={cn("relative overflow-hidden rounded-xl border border-border bg-card p-4", className)}>
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <p className="text-sm text-muted-foreground">{title}</p>
          <p className="text-2xl font-medium text-foreground">{value}</p>
        </div>
        <div className="flex flex-col items-end gap-2">
          {badge && (
            <span className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded">
              {badge}
            </span>
          )}
          <div className="flex size-12 items-center justify-center rounded-lg bg-muted border border-border">
            <Icon className="size-6 text-muted-foreground" />
          </div>
        </div>
      </div>
    </div>
  );
}
