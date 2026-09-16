"use client";

import { HugeiconsIcon } from "@hugeicons/react";
import {
  Ticket01Icon,
  Clock01Icon,
  Tick02Icon,
  CancelCircleIcon,
  StarIcon,
} from "@hugeicons/core-free-icons";

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
  showReviews?: boolean;
}

export function VoucherSummary({
  stats,
  reviews = [],
  showReviews = true,
}: VoucherSummaryProps) {
  return (
    <div className="space-y-6">
      <div className="admin-surface p-5">
        <h3 className="mb-4 flex items-center gap-2 font-medium text-foreground">
          <HugeiconsIcon
            icon={Ticket01Icon}
            className="size-4 text-muted-foreground"
          />
          Voucher Summary
        </h3>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-2 text-sm text-muted-foreground">
              <HugeiconsIcon icon={Clock01Icon} className="size-4 text-primary" />
              Active
            </span>
            <span className="font-semibold text-foreground tabular-nums">
              {stats.active}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-2 text-sm text-muted-foreground">
              <HugeiconsIcon icon={Tick02Icon} className="size-4 text-primary" />
              Redeemed
            </span>
            <span className="font-semibold text-foreground tabular-nums">
              {stats.redeemed}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-2 text-sm text-muted-foreground">
              <HugeiconsIcon
                icon={CancelCircleIcon}
                className="size-4 text-destructive"
              />
              Expired
            </span>
            <span className="font-semibold text-foreground tabular-nums">
              {stats.expired}
            </span>
          </div>
        </div>
      </div>

      {showReviews ? (
        <div className="admin-surface p-5">
          <h3 className="mb-4 flex items-center gap-2 font-medium text-foreground">
            <HugeiconsIcon icon={StarIcon} className="size-4 text-primary" />
            Recent Reviews
          </h3>
          {reviews.length > 0 ? (
            <div className="space-y-3">
              {reviews.slice(0, 3).map((review) => (
                <div
                  key={review.id}
                  className="border-l-2 border-border pl-3 text-sm"
                >
                  <div className="mb-1 flex items-center gap-1">
                    {[...Array(5)].map((_, index) => (
                      <HugeiconsIcon
                        key={index}
                        icon={StarIcon}
                        className={`size-3 ${
                          index < review.rating
                            ? "fill-warning text-warning"
                            : "text-muted-foreground"
                        }`}
                      />
                    ))}
                  </div>
                  <p className="line-clamp-1 text-muted-foreground">
                    {review.comment || "No comment"}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {review.customerName}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No reviews yet</p>
          )}
        </div>
      ) : null}
    </div>
  );
}
