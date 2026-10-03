import { BuyersClient } from "@/components/admin/buyers-client";
import { getBuyersPage, normalizeBuyerListParams } from "@/lib/actions/buyers";
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
  const buyersPage = await getBuyersPage(normalizeBuyerListParams(raw));

  return <BuyersClient initialPage={buyersPage} />;
}
