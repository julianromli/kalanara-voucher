import { getAdminUsers } from "@/lib/actions/admin-users";
import { requireAdminRouteAccess } from "@/lib/auth/admin-rbac-server";
import { AdminUsersClient } from "@/components/admin/admin-users-client";

export default async function AdminUsersPage() {
  await requireAdminRouteAccess("/admin/users");
  const users = await getAdminUsers();

  return <AdminUsersClient initialUsers={users} />;
}
