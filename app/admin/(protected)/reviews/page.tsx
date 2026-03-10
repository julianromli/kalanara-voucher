import { getAdminReviews } from "@/lib/actions/reviews";
import { requireAdminRouteAccess } from "@/lib/auth/admin-rbac-server";
import { ReviewsClient } from "@/components/admin/reviews-client";

export default async function AdminReviewsPage() {
  await requireAdminRouteAccess("/admin/reviews");
  const reviews = await getAdminReviews();

  return <ReviewsClient initialReviews={reviews} />;
}
