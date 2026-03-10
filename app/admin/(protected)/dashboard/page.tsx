import { getDashboardStats } from "@/lib/actions/dashboard";
import { requireAdminRouteAccess } from "@/lib/auth/admin-rbac-server";
import { DashboardClient } from "@/components/admin/dashboard-client";

export default async function AdminDashboardPage() {
  await requireAdminRouteAccess("/admin/dashboard");
  const stats = await getDashboardStats();

  return <DashboardClient stats={stats} />;
}
