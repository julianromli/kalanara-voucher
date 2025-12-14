import { getReviews } from "@/lib/actions/reviews";
import { ReviewsClient } from "@/components/admin/reviews-client";

export default async function AdminReviewsPage() {
  const reviews = await getReviews();

  return <ReviewsClient initialReviews={reviews} />;
}
