import { PurchasesClient } from "@/components/admin/purchases-client";
import {
  normalizeAdminListParams,
} from "@/lib/actions/admin-pagination";
import { getAdminOrderById, getOrdersPage, getOrdersTotalCount } from "@/lib/actions/orders";
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
    order?: string | string[];
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
  const orderId = Array.isArray(raw.order) ? raw.order[0] : raw.order;
  const [ordersPage, ordersTotalCount, focusedOrder] = await Promise.all([
    getOrdersPage(params),
    getOrdersTotalCount(),
    orderId ? getAdminOrderById(orderId) : Promise.resolve(null),
  ]);

  return (
      <PurchasesClient
        initialPage={ordersPage}
        initialTotalCount={ordersTotalCount}
        focusedOrder={focusedOrder}
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
