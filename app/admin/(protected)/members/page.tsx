import { MembersClient } from "@/components/admin/members/members-client";
import { listRecentMembers, listStampServices } from "@/lib/actions/members";
import { requireAdminRouteAccess } from "@/lib/auth/admin-rbac-server";

export default async function AdminMembersPage() {
  await requireAdminRouteAccess("/admin/members");
  const [recent, services] = await Promise.all([
    listRecentMembers(),
    listStampServices(),
  ]);

  return (
    <MembersClient
      initialRecent={recent.status === "ok" ? recent.members : []}
      services={services.status === "ok" ? services.services : []}
    />
  );
}
