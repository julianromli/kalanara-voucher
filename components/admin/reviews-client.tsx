"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { DashboardHeader } from "@/components/admin/dashboard-header";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { HugeiconsIcon } from "@hugeicons/react";
import { StarIcon } from "@hugeicons/core-free-icons";
import { deleteReview } from "@/lib/actions/reviews";
import type { Review } from "@/lib/database.types";

interface ReviewsClientProps {
  initialReviews: Review[];
}

export function ReviewsClient({ initialReviews }: ReviewsClientProps) {
  const router = useRouter();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const { showToast } = useToast();
  const [reviews, setReviews] = useState(initialReviews);
  const [searchQuery, setSearchQuery] = useState("");
  const [ratingFilter, setRatingFilter] = useState("ALL");

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push("/admin/login");
    }
  }, [authLoading, isAuthenticated, router]);

  const filteredReviews = reviews.filter((review) => {
    const matchesSearch = 
      review.customer_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (review.comment && review.comment.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesRating = ratingFilter === "ALL" || review.rating.toString() === ratingFilter;
    return matchesSearch && matchesRating;
  });

  const handleDeleteReview = async (reviewId: string) => {
    const previousReviews = [...reviews];
    setReviews(reviews.filter(r => r.id !== reviewId));

    try {
      const success = await deleteReview(reviewId);
      if (success) {
        showToast("Review deleted successfully", "success");
      } else {
        throw new Error("Failed to delete");
      }
    } catch {
      setReviews(previousReviews);
      showToast("Failed to delete review", "error");
    }
  };

  if (authLoading || !isAuthenticated) {
    return null;
  }

  return (
    <>
      <DashboardHeader title="Reviews Management" showActions={false} />
      <div className="w-full overflow-y-auto overflow-x-hidden p-4 md:p-6 h-full">
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <p className="text-muted-foreground text-sm">
              Moderate customer reviews and feedback
            </p>
          </div>

          <div className="bg-card rounded-2xl shadow-spa border border-border p-4">
            <div className="flex flex-col md:flex-row gap-4 mb-6">
              <Input
                placeholder="Search reviews..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="flex-1"
              />
              <select
                value={ratingFilter}
                onChange={(e) => setRatingFilter(e.target.value)}
                className="px-3 py-2 border border-border rounded-lg"
              >
                <option value="ALL">All Ratings</option>
                <option value="5">5 Stars</option>
                <option value="4">4 Stars</option>
                <option value="3">3 Stars</option>
                <option value="2">2 Stars</option>
                <option value="1">1 Star</option>
              </select>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredReviews.map((review) => (
                <div
                  key={review.id}
                  className="bg-card rounded-2xl shadow-spa border border-border p-5 hover:shadow-spa-lg transition-shadow"
                >
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-semibold">{review.customer_name}</h3>
                    <div className="flex items-center gap-1">
                      {[...Array(5)].map((_, i) => (
                        <HugeiconsIcon
                          key={i}
                          icon={StarIcon}
                          className={`w-4 h-4 ${
                            i < review.rating ? "text-yellow-400 fill-yellow-400" : "text-gray-300"
                          }`}
                        />
                      ))}
                    </div>
                  </div>

                  {review.comment && (
                    <p className="text-sm text-muted-foreground mb-4 line-clamp-3">
                      "{review.comment}"
                    </p>
                  )}

                  <div className="flex items-center justify-between pt-3 border-t border-border">
                    <Badge variant="outline">{review.rating}/5</Badge>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleDeleteReview(review.id)}
                        className="text-destructive hover:text-destructive hover:bg-destructive/10"
                      >
                        Delete
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {filteredReviews.length === 0 && (
              <div className="text-center py-12">
                <p className="text-muted-foreground">No reviews found</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
