import { getVouchers } from "@/lib/actions/vouchers";
import { requireAdminRouteAccess } from "@/lib/auth/admin-rbac-server";
import { VouchersClient } from "@/components/admin/vouchers-client";

export default async function AdminVouchersPage() {
  await requireAdminRouteAccess("/admin/vouchers");
  const vouchers = await getVouchers();

  return <VouchersClient initialVouchers={vouchers} />;
}
