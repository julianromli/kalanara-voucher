import { BuyersClient } from "@/components/admin/buyers-client";
import { normalizeAdminListParams } from "@/lib/actions/admin-pagination";
import { getBuyersPage } from "@/lib/actions/buyers";
import { requireAdminRouteAccess } from "@/lib/auth/admin-rbac-server";

interface AdminBuyersPageProps {
  searchParams: Promise<{
    page?: string | string[];
    query?: string | string[];
  }>;
}

export default async function AdminBuyersPage({
  searchParams,
}: AdminBuyersPageProps) {
  await requireAdminRouteAccess("/admin/buyers");
  const raw = await searchParams;
  const buyersPage = await getBuyersPage(normalizeAdminListParams(raw, ["ALL"]));

  return <BuyersClient initialPage={buyersPage} />;
}
