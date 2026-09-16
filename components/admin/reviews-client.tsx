"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { HugeiconsIcon } from "@hugeicons/react";
import { StarIcon } from "@hugeicons/core-free-icons";
import { AdminListPagination } from "@/components/admin/admin-list-pagination";
import { DashboardHeader } from "@/components/admin/dashboard-header";
import {
  AdminEmptyState,
  AdminPageBody,
  AdminPageIntro,
  AdminSurface,
} from "@/components/admin/admin-page";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import { useAdminListUrl } from "@/hooks/use-admin-list-url";
import type { AdminPage } from "@/lib/actions/admin-pagination";
import {
  deleteReview,
  type ReviewAdminListRow,
} from "@/lib/actions/reviews";
import { cn } from "@/lib/utils";

interface ReviewsClientProps {
  initialPage: AdminPage<ReviewAdminListRow>;
}

export function ReviewsClient({
  initialPage,
}: ReviewsClientProps) {
  const router = useRouter();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const { showToast } = useToast();
  const [reviews, setReviews] = useState(initialPage.rows);
  const {
    query: searchQuery,
    setQuery: setSearchQuery,
    filter: ratingFilter,
    setFilter: setRatingFilter,
    setPage,
  } = useAdminListUrl({
    filterParam: "rating",
  });

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push("/admin/login");
    }
  }, [authLoading, isAuthenticated, router]);

  useEffect(() => {
    setReviews(initialPage.rows);
  }, [initialPage.rows]);

  const handleDeleteReview = async (reviewId: string) => {
    const previousReviews = reviews;
    setReviews((currentReviews) =>
      currentReviews.filter((review) => review.id !== reviewId),
    );

    try {
      const success = await deleteReview(reviewId);
      if (!success) {
        throw new Error("Failed to delete");
      }

      showToast("Review deleted successfully", "success");
      router.refresh();
      if (reviews.length === 1 && initialPage.page > 1) {
        setPage(initialPage.page - 1);
      }
    } catch {
      setReviews(previousReviews);
      showToast("Failed to delete review", "error");
    }
  };

  if (!isAuthenticated && !authLoading) {
    return null;
  }

  return (
    <>
      <DashboardHeader title="Reviews Management" showActions={false} />
      <AdminPageBody>
        <AdminPageIntro description="Moderate customer reviews and feedback." />

        <AdminSurface>
          <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-center">
            <Input
              placeholder="Search reviews..."
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              className="flex-1"
            />
            <Select value={ratingFilter} onValueChange={setRatingFilter}>
              <SelectTrigger className="w-full md:w-40">
                <SelectValue placeholder="All Ratings" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Ratings</SelectItem>
                <SelectItem value="5">5 Stars</SelectItem>
                <SelectItem value="4">4 Stars</SelectItem>
                <SelectItem value="3">3 Stars</SelectItem>
                <SelectItem value="2">2 Stars</SelectItem>
                <SelectItem value="1">1 Star</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {reviews.length === 0 ? (
            <AdminEmptyState
              title="Belum ada ulasan"
              description="Ulasan pelanggan akan muncul di sini setelah tamu mengirim umpan balik."
            />
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              {reviews.map((review) => (
                <div
                  key={review.id}
                  className="rounded-xl border border-border bg-background/60 p-5"
                >
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <h3 className="truncate font-semibold">{review.customer_name}</h3>
                    <div className="flex items-center gap-1">
                      {[1, 2, 3, 4, 5].map((ratingValue) => (
                        <HugeiconsIcon
                          key={`${review.id}-${ratingValue}`}
                          icon={StarIcon}
                          className={cn(
                            "size-4",
                            ratingValue <= review.rating
                              ? "fill-warning text-warning"
                              : "text-muted-foreground/40",
                          )}
                        />
                      ))}
                    </div>
                  </div>

                  {review.comment ? (
                    <p className="mb-4 line-clamp-3 text-sm text-pretty text-muted-foreground">
                      &ldquo;{review.comment}&rdquo;
                    </p>
                  ) : null}

                  <div className="flex items-center justify-between border-t border-border pt-3">
                    <Badge variant="outline">{review.rating}/5</Badge>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleDeleteReview(review.id)}
                      className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                    >
                      Delete
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <AdminListPagination
            itemLabel="ulasan"
            page={initialPage.page}
            totalCount={initialPage.totalCount}
            totalPages={initialPage.totalPages}
            onPageChange={setPage}
          />
        </AdminSurface>
      </AdminPageBody>
    </>
  );
}
