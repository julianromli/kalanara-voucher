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

const iconColors: Record<string, string> = {
  revenue: "text-success bg-success/10 border-success/20",
  services: "text-info bg-info/10 border-info/20",
  orders: "text-info bg-info/10 border-info/20",
  rating: "text-warning bg-warning/10 border-warning/20",
  vouchers: "text-primary bg-primary/10 border-primary/20",
  active: "text-success bg-success/10 border-success/20",
  redeemed: "text-info bg-info/10 border-info/20",
  expired: "text-destructive bg-destructive/10 border-destructive/20",
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
  const colorClass = iconColors[icon] || "text-muted-foreground bg-muted border-border";

  return (
    <div className={cn(
      "relative overflow-hidden rounded-xl border border-border bg-card p-5 transition-all duration-300 hover:shadow-spa hover:border-border/80 group",
      className
    )}>
      <div className="flex items-start justify-between">
        <div className="space-y-1.5">
          <p className="text-sm text-muted-foreground font-medium tracking-tight">{title}</p>
          <p className="text-2xl font-semibold text-foreground tracking-tight">{value}</p>
        </div>
        <div className="flex flex-col items-end gap-2">
          {badge && (
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground bg-muted/80 px-2 py-0.5 rounded-full font-medium">
              {badge}
            </span>
          )}
          <div className={cn(
            "flex size-12 items-center justify-center rounded-xl border transition-transform duration-300 group-hover:scale-105",
            colorClass
          )}>
            <Icon className="size-5" />
          </div>
        </div>
      </div>
    </div>
  );
}
