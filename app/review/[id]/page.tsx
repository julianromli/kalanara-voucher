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
      submitReview={async ({ rating, comment, customerName }) => {
        "use server";

        const serverVoucher = await getPublicVoucherLookupByCode(id);
        if (!serverVoucher) {
          return { success: false, error: "Voucher tidak ditemukan." };
        }

        const review = await createReview({
          voucher_id: serverVoucher.id,
          rating,
          comment: comment || null,
          customer_name: customerName,
        });

        if (!review) {
          return { success: false, error: "Gagal mengirim review. Silakan coba lagi." };
        }

        return { success: true };
      }}
    />
  );
}
