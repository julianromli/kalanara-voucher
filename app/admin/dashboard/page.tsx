import { getDashboardStats } from "@/lib/actions/dashboard";
import { DashboardClient } from "@/components/admin/dashboard-client";

export default async function AdminDashboardPage() {
  const stats = await getDashboardStats();

  return <DashboardClient stats={stats} />;
}
