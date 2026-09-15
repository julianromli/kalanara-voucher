import { normalizeAdminListParams } from "@/lib/actions/admin-pagination";
import { getAdminReviewsPage } from "@/lib/actions/reviews";
import { requireAdminRouteAccess } from "@/lib/auth/admin-rbac-server";
import { ReviewsClient } from "@/components/admin/reviews-client";

interface AdminReviewsPageProps {
  searchParams: Promise<{
    page?: string | string[];
    query?: string | string[];
    rating?: string | string[];
  }>;
}

const REVIEW_FILTERS = ["ALL", "1", "2", "3", "4", "5"] as const;

export default async function AdminReviewsPage({
  searchParams,
}: AdminReviewsPageProps) {
  await requireAdminRouteAccess("/admin/reviews");
  const raw = await searchParams;
  const params = normalizeAdminListParams(
    {
      page: raw.page,
      query: raw.query,
      filter: raw.rating,
    },
    REVIEW_FILTERS,
  );
  const reviewsPage = await getAdminReviewsPage(params);

  return (
    <ReviewsClient
      initialPage={reviewsPage}
    />
  );
}
