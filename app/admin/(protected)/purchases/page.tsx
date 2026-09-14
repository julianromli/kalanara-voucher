import { PurchasesClient } from "@/components/admin/purchases-client";
import {
  normalizeAdminListParams,
} from "@/lib/actions/admin-pagination";
import { getOrdersPage } from "@/lib/actions/orders";
import {
  AdminPermission,
  hasPermissionForRole,
} from "@/lib/auth/admin-rbac";
import { requireAdminRouteAccess } from "@/lib/auth/admin-rbac-server";

interface AdminPurchasesPageProps {
  searchParams: Promise<{
    page?: string;
    query?: string;
    status?: string;
  }>;
}

const PURCHASE_FILTERS = [
  "ALL",
  "PENDING",
  "COMPLETED",
  "FAILED",
  "REFUNDED",
] as const;

export default async function AdminPurchasesPage({
  searchParams,
}: AdminPurchasesPageProps) {
  const access = await requireAdminRouteAccess("/admin/purchases");
  const raw = await searchParams;
  const params = normalizeAdminListParams(
    {
      page: raw.page,
      query: raw.query,
      filter: raw.status,
    },
    PURCHASE_FILTERS,
  );
  const ordersPage = await getOrdersPage(params);

  return (
      <PurchasesClient
        key={`${params.query}:${params.filter}`}
        initialPage={ordersPage}
        initialQuery={params.query}
        initialFilter={params.filter}
        canUpdatePaymentStatus={hasPermissionForRole(
          access.role,
          AdminPermission.ORDERS_UPDATE_PAYMENT_STATUS
        )}
        canDeletePurchases={hasPermissionForRole(
          access.role,
          AdminPermission.ORDERS_DELETE_HARD
        )}
      />
    );
}
