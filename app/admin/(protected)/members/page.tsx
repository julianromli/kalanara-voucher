import { AdminPageBody } from "@/components/admin/admin-page";
import { DashboardHeader } from "@/components/admin/dashboard-header";
import { requireAdminRouteAccess } from "@/lib/auth/admin-rbac-server";

export default async function AdminMembersPage() {
  await requireAdminRouteAccess("/admin/members");

  return (
    <>
      <DashboardHeader title="Member" showActions={false} />
      <AdminPageBody>
        <p className="text-sm text-muted-foreground">Member</p>
      </AdminPageBody>
    </>
  );
}
