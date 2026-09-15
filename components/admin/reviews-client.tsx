"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { HugeiconsIcon } from "@hugeicons/react";
import { StarIcon } from "@hugeicons/core-free-icons";
import { AdminListPagination } from "@/components/admin/admin-list-pagination";
import { DashboardHeader } from "@/components/admin/dashboard-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  initialQuery: string;
  initialFilter: string;
}

export function ReviewsClient({
  initialPage,
  initialQuery,
  initialFilter,
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
    initialQuery,
    initialFilter,
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
      <div className="h-full w-full overflow-x-hidden overflow-y-auto p-4 md:p-6">
        <div className="space-y-6">
          <p className="text-sm text-muted-foreground">
            Moderate customer reviews and feedback
          </p>

          <div className="rounded-2xl border border-border bg-card p-4 shadow-spa">
            <div className="mb-6 flex flex-col gap-4 md:flex-row">
              <Input
                placeholder="Search reviews..."
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                className="flex-1"
              />
              <select
                value={ratingFilter}
                onChange={(event) => setRatingFilter(event.target.value)}
                className="rounded-lg border border-border px-3 py-2"
              >
                <option value="ALL">All Ratings</option>
                <option value="5">5 Stars</option>
                <option value="4">4 Stars</option>
                <option value="3">3 Stars</option>
                <option value="2">2 Stars</option>
                <option value="1">1 Star</option>
              </select>
            </div>

            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
              {reviews.map((review) => (
                <div
                  key={review.id}
                  className="rounded-2xl border border-border bg-card p-5 shadow-spa transition-shadow hover:shadow-spa-lg"
                >
                  <div className="mb-3 flex items-center justify-between">
                    <h3 className="font-semibold">{review.customer_name}</h3>
                    <div className="flex items-center gap-1">
                      {[1, 2, 3, 4, 5].map((ratingValue) => (
                        <HugeiconsIcon
                          key={`${review.id}-${ratingValue}`}
                          icon={StarIcon}
                          className={cn(
                            "size-4",
                            ratingValue <= review.rating
                              ? "fill-yellow-400 text-yellow-400"
                              : "text-gray-300",
                          )}
                        />
                      ))}
                    </div>
                  </div>

                  {review.comment ? (
                    <p className="mb-4 line-clamp-3 text-sm text-muted-foreground">
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

            {reviews.length === 0 ? (
              <div className="py-12 text-center">
                <p className="text-muted-foreground">No reviews found</p>
              </div>
            ) : null}

            <AdminListPagination
              itemLabel="ulasan"
              page={initialPage.page}
              totalCount={initialPage.totalCount}
              totalPages={initialPage.totalPages}
              onPageChange={setPage}
            />
          </div>
        </div>
      </div>
    </>
  );
}
