import { DiscountCodesClient } from "@/components/admin/discount-codes-client";
import { getDiscountCodes } from "@/lib/actions/discount-codes";
import { requireAdminRouteAccess } from "@/lib/auth/admin-rbac-server";

export default async function AdminDiscountCodesPage() {
  await requireAdminRouteAccess("/admin/discount-codes");
  const discountCodes = await getDiscountCodes();

  return <DiscountCodesClient initialDiscountCodes={discountCodes} />;
}
