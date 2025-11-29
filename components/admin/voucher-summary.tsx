"use client";

import { Ticket, Clock, CheckCircle, XCircle, Star } from "lucide-react";

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
}

export function VoucherSummary({ stats, reviews = [] }: VoucherSummaryProps) {
  return (
    <div className="space-y-6">
      {/* Voucher Stats */}
      <div className="rounded-xl border border-border bg-card p-5">
        <h3 className="font-medium text-foreground mb-4 flex items-center gap-2">
          <Ticket className="size-4 text-muted-foreground" />
          Voucher Summary
        </h3>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground flex items-center gap-2 text-sm">
              <Clock className="size-4 text-success" />
              Active
            </span>
            <span className="font-semibold text-foreground">{stats.active}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground flex items-center gap-2 text-sm">
              <CheckCircle className="size-4 text-info" />
              Redeemed
            </span>
            <span className="font-semibold text-foreground">{stats.redeemed}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground flex items-center gap-2 text-sm">
              <XCircle className="size-4 text-destructive" />
              Expired
            </span>
            <span className="font-semibold text-foreground">{stats.expired}</span>
          </div>
        </div>
      </div>

      {/* Recent Reviews */}
      <div className="rounded-xl border border-border bg-card p-5">
        <h3 className="font-medium text-foreground mb-4 flex items-center gap-2">
          <Star className="size-4 text-warning" />
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
                    <Star
                      key={i}
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
