import { PurchasesClient } from "@/components/admin/purchases-client";
import {
  normalizeAdminListParams,
} from "@/lib/actions/admin-pagination";
import { getOrdersPage, getOrdersTotalCount } from "@/lib/actions/orders";
import {
  AdminPermission,
  hasPermissionForRole,
} from "@/lib/auth/admin-rbac";
import { requireAdminRouteAccess } from "@/lib/auth/admin-rbac-server";

interface AdminPurchasesPageProps {
  searchParams: Promise<{
    page?: string | string[];
    query?: string | string[];
    status?: string | string[];
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
  const [ordersPage, ordersTotalCount] = await Promise.all([
    getOrdersPage(params),
    getOrdersTotalCount(),
  ]);

  return (
      <PurchasesClient
        key={`${params.query}:${params.filter}`}
        initialPage={ordersPage}
        initialTotalCount={ordersTotalCount}
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
