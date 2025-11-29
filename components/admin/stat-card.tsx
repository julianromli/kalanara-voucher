"use client";

import { useEffect, useState } from "react";
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
  animationDelay?: number;
}

export function StatCard({ title, value, icon, badge, className, animationDelay = 0 }: StatCardProps) {
  const Icon = iconMap[icon] || Tag;
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setIsMounted(true), 50);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div 
      className={cn(
        "relative overflow-hidden rounded-xl border border-border bg-card p-5 transition-all duration-300 hover:shadow-spa hover:border-border/80 group card-hover-lift",
        isMounted ? "animate-fade-slide-up" : "opacity-0",
        className
      )}
      style={{ animationDelay: `${animationDelay}ms` }}
    >
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
            "flex size-12 items-center justify-center rounded-xl border border-primary/20 bg-primary transition-transform duration-300 group-hover:scale-105",
            isMounted && "animate-icon-bounce"
          )} style={{ animationDelay: `${animationDelay + 200}ms` }}>
            <Icon className="size-5 text-primary-foreground" />
          </div>
        </div>
      </div>
    </div>
  );
}
