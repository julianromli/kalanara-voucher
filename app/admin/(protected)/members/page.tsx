import { MembersClient } from "@/components/admin/members/members-client";
import { listMembers, listRecentMembers, listStampServices } from "@/lib/actions/members";
import { requireAdminRouteAccess } from "@/lib/auth/admin-rbac-server";

export default async function AdminMembersPage() {
  await requireAdminRouteAccess("/admin/members");
  const [recent, services, members] = await Promise.all([
    listRecentMembers(),
    listStampServices(),
    listMembers({ page: 1, query: "", tier: "all" }),
  ]);

  return (
    <MembersClient
      initialRecent={recent.status === "ok" ? recent.members : []}
      initialList={members.status === "ok" ? members : null}
      services={services.status === "ok" ? services.services : []}
      servicesError={services.status !== "ok"}
    />
  );
}
