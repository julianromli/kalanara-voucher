import { getVouchers } from "@/lib/actions/vouchers";
import { VouchersClient } from "@/components/admin/vouchers-client";

export default async function AdminVouchersPage() {
  const vouchers = await getVouchers();

  return <VouchersClient initialVouchers={vouchers} />;
}
