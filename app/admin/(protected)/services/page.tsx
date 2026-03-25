import { getAllServices } from "@/lib/actions/services";
import { getAllServiceCategories } from "@/lib/actions/service-categories";
import { requireAdminRouteAccess } from "@/lib/auth/admin-rbac-server";
import { ServicesClient } from "@/components/admin/services-client";

export default async function AdminServicesPage() {
  await requireAdminRouteAccess("/admin/services");
  const [services, categories] = await Promise.all([
    getAllServices(),
    getAllServiceCategories()
  ]);

  return <ServicesClient initialServices={services} initialCategories={categories} />;
}
