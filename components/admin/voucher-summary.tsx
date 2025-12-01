"use client";

import { useEffect, useState } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Ticket01Icon,
  Clock01Icon,
  Tick02Icon,
  CancelCircleIcon,
  StarIcon,
} from "@hugeicons/core-free-icons";
import { cn } from "@/lib/utils";

interface VoucherStats {
  active: number;
  redeemed: number;
  expired: number;
}

interface Review {
  id: string;
  rating: number;
  comment: string | null;
  customerName: string;
}

interface VoucherSummaryProps {
  stats: VoucherStats;
  reviews?: Review[];
  animationDelay?: number;
}

export function VoucherSummary({ stats, reviews = [], animationDelay = 0 }: VoucherSummaryProps) {
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setIsMounted(true), 50);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="space-y-6">
      {/* Voucher Stats */}
      <div 
        className={cn(
          "rounded-xl border border-border bg-card p-5",
          isMounted ? "animate-scale-in" : "opacity-0"
        )}
        style={{ animationDelay: `${animationDelay}ms` }}
      >
        <h3 className="font-medium text-foreground mb-4 flex items-center gap-2">
          <HugeiconsIcon icon={Ticket01Icon} className="size-4 text-muted-foreground" />
          Voucher Summary
        </h3>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground flex items-center gap-2 text-sm">
              <HugeiconsIcon icon={Clock01Icon} className="size-4 text-primary" />
              Active
            </span>
            <span className="font-semibold text-foreground">{stats.active}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground flex items-center gap-2 text-sm">
              <HugeiconsIcon icon={Tick02Icon} className="size-4 text-primary" />
              Redeemed
            </span>
            <span className="font-semibold text-foreground">{stats.redeemed}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground flex items-center gap-2 text-sm">
              <HugeiconsIcon icon={CancelCircleIcon} className="size-4 text-destructive" />
              Expired
            </span>
            <span className="font-semibold text-foreground">{stats.expired}</span>
          </div>
        </div>
      </div>

      {/* Recent Reviews */}
      <div 
        className={cn(
          "rounded-xl border border-border bg-card p-5",
          isMounted ? "animate-scale-in" : "opacity-0"
        )}
        style={{ animationDelay: `${animationDelay + 100}ms` }}
      >
        <h3 className="font-medium text-foreground mb-4 flex items-center gap-2">
          <HugeiconsIcon icon={StarIcon} className="size-4 text-primary" />
          Recent Reviews
        </h3>
        {reviews.length > 0 ? (
          <div className="space-y-3">
            {reviews.slice(0, 3).map((review) => (
              <div
                key={review.id}
                className="text-sm border-l-2 border-border pl-3"
              >
                <div className="flex items-center gap-1 mb-1">
                  {[...Array(5)].map((_, i) => (
                    <HugeiconsIcon
                      key={i}
                      icon={StarIcon}
                      className={`size-3 ${
                        i < review.rating
                          ? "text-warning fill-warning"
                          : "text-muted-foreground"
                      }`}
                    />
                  ))}
                </div>
                <p className="text-muted-foreground line-clamp-1">
                  {review.comment || "No comment"}
                </p>
                <p className="text-muted-foreground text-xs mt-1">
                  {review.customerName}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-muted-foreground text-sm">No reviews yet</p>
        )}
      </div>
    </div>
  );
}
