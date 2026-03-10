import { getAllServices } from "@/lib/actions/services";
import { requireAdminRouteAccess } from "@/lib/auth/admin-rbac-server";
import { ServicesClient } from "@/components/admin/services-client";

export default async function AdminServicesPage() {
  await requireAdminRouteAccess("/admin/services");
  const services = await getAllServices();

  return <ServicesClient initialServices={services} />;
}
