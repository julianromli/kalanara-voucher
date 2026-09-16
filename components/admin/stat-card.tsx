"use client";

import { HugeiconsIcon, type IconSvgElement } from "@hugeicons/react";
import {
  ChartIncreaseIcon,
  Tag01Icon,
  ShoppingBag01Icon,
  StarIcon,
  Ticket01Icon,
  Clock01Icon,
  Tick02Icon,
  CancelCircleIcon,
} from "@hugeicons/core-free-icons";
import { cn } from "@/lib/utils";

const iconMap: Record<string, IconSvgElement> = {
  revenue: ChartIncreaseIcon,
  services: Tag01Icon,
  orders: ShoppingBag01Icon,
  rating: StarIcon,
  vouchers: Ticket01Icon,
  active: Clock01Icon,
  redeemed: Tick02Icon,
  expired: CancelCircleIcon,
};

interface StatCardProps {
  title: string;
  value: string | number;
  icon: keyof typeof iconMap;
  badge?: string;
  className?: string;
}

export function StatCard({
  title,
  value,
  icon,
  badge,
  className,
}: StatCardProps) {
  const IconComponent = iconMap[icon] || Tag01Icon;

  return (
    <div
      className={cn(
        "admin-surface admin-card-hover group relative overflow-hidden p-5",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-1.5">
          <p className="text-sm font-medium tracking-tight text-muted-foreground">
            {title}
          </p>
          <p className="truncate text-2xl font-semibold tracking-tight text-foreground tabular-nums">
            {value}
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-2">
          {badge ? (
            <span className="rounded-full bg-muted/80 px-2 py-0.5 text-[10px] font-medium tracking-wider text-muted-foreground uppercase whitespace-nowrap">
              {badge}
            </span>
          ) : null}
          <div className="flex size-12 items-center justify-center rounded-xl border border-primary/20 bg-primary">
            <HugeiconsIcon
              icon={IconComponent}
              size={20}
              className="text-primary-foreground"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
