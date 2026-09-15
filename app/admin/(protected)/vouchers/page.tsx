import { normalizeAdminListParams } from "@/lib/actions/admin-pagination";
import {
  getVoucherAdminSummary,
  getVouchersPage,
} from "@/lib/actions/vouchers";
import { requireAdminRouteAccess } from "@/lib/auth/admin-rbac-server";
import { VouchersClient } from "@/components/admin/vouchers-client";

interface AdminVouchersPageProps {
  searchParams: Promise<{
    page?: string | string[];
    query?: string | string[];
    status?: string | string[];
  }>;
}

const VOUCHER_FILTERS = ["ALL", "ACTIVE", "REDEEMED", "EXPIRED"] as const;

export default async function AdminVouchersPage({
  searchParams,
}: AdminVouchersPageProps) {
  await requireAdminRouteAccess("/admin/vouchers");
  const raw = await searchParams;
  const params = normalizeAdminListParams(
    {
      page: raw.page,
      query: raw.query,
      filter: raw.status,
    },
    VOUCHER_FILTERS,
  );
  const [vouchersPage, voucherSummary] = await Promise.all([
    getVouchersPage(params),
    getVoucherAdminSummary(),
  ]);

  return (
    <VouchersClient
      initialPage={vouchersPage}
      initialSummary={voucherSummary}
    />
  );
}
