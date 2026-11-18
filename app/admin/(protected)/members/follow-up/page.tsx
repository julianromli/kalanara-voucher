import { AdminPageBody } from "@/components/admin/admin-page";
import { DashboardHeader } from "@/components/admin/dashboard-header";
import { requireAdminRouteAccess } from "@/lib/auth/admin-rbac-server";

export default async function AdminMemberFollowUpPage() {
  await requireAdminRouteAccess("/admin/members/follow-up");

  return (
    <>
      <DashboardHeader title="Follow up hari ini" showActions={false} />
      <AdminPageBody>
        <p className="text-sm text-muted-foreground">Follow up</p>
      </AdminPageBody>
    </>
  );
}
