import { ReviewPageClient } from "@/app/review/[id]/review-page-client";
import {
  createPublicReview,
  getPublicReviewVoucherByCode,
} from "@/lib/actions/reviews";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function ReviewPage({ params }: PageProps) {
  const { id } = await params;
  const voucher = await getPublicReviewVoucherByCode(id);

  return (
    <ReviewPageClient
      voucher={voucher}
      submitReview={async ({ rating, comment, customerName }) => {
        "use server";

        return createPublicReview(id, {
          rating,
          comment: comment || null,
          customer_name: customerName,
        });
      }}
    />
  );
}
