import { ReviewPageClient } from "@/app/review/[id]/review-page-client";
import { createReview } from "@/lib/actions/reviews";
import { getPublicVoucherLookupByCode } from "@/lib/actions/vouchers";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function ReviewPage({ params }: PageProps) {
  const { id } = await params;
  const voucher = await getPublicVoucherLookupByCode(id);

  return (
    <ReviewPageClient
      voucher={voucher}
      submitReview={async ({ voucherId, rating, comment, customerName }) => {
        "use server";

        const review = await createReview({
          voucher_id: voucherId,
          rating,
          comment: comment || null,
          customer_name: customerName,
        });

        return { success: Boolean(review) };
      }}
    />
  );
}
