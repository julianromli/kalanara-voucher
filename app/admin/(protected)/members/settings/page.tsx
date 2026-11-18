import { AdminPageBody } from "@/components/admin/admin-page";
import { DashboardHeader } from "@/components/admin/dashboard-header";
import { requireAdminRouteAccess } from "@/lib/auth/admin-rbac-server";

export default async function AdminMemberSettingsPage() {
  await requireAdminRouteAccess("/admin/members/settings");

  return (
    <>
      <DashboardHeader title="Pengaturan member" showActions={false} />
      <AdminPageBody>
        <p className="text-sm text-muted-foreground">Pengaturan member</p>
      </AdminPageBody>
    </>
  );
}
