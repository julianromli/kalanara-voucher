import { PurchasesClient } from "@/components/admin/purchases-client";
import { getOrders } from "@/lib/actions/orders";
import {
  AdminPermission,
  hasPermissionForRole,
} from "@/lib/auth/admin-rbac";
import { requireAdminRouteAccess } from "@/lib/auth/admin-rbac-server";

export default async function AdminPurchasesPage() {
  const access = await requireAdminRouteAccess("/admin/purchases");
  const orders = await getOrders();

  return (
    <PurchasesClient
      initialOrders={orders}
      canUpdatePaymentStatus={hasPermissionForRole(
        access.role,
        AdminPermission.ORDERS_UPDATE_PAYMENT_STATUS
      )}
    />
  );
}
