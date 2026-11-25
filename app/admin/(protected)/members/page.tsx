import { MembersClient } from "@/components/admin/members/members-client";
import { listMembers, listRecentMembers, listStampServices } from "@/lib/actions/members";
import { requireAdminRouteAccess } from "@/lib/auth/admin-rbac-server";

interface AdminMembersPageProps {
  searchParams: Promise<{
    member?: string | string[];
  }>;
}

function firstValue(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value;
}

export default async function AdminMembersPage({ searchParams }: AdminMembersPageProps) {
  await requireAdminRouteAccess("/admin/members");
  const raw = await searchParams;
  const [recent, services, members] = await Promise.all([
    listRecentMembers(),
    listStampServices(),
    listMembers({ page: 1, query: "", tier: "all" }),
  ]);

  return (
    <MembersClient
      initialRecent={recent.status === "ok" ? recent.members : []}
      initialList={members.status === "ok" ? members : null}
      initialMember={firstValue(raw.member)}
      services={services.status === "ok" ? services.services : []}
      servicesError={services.status !== "ok"}
    />
  );
}
