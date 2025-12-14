import { getAdminUsers } from "@/lib/actions/admin-users";
import { AdminUsersClient } from "@/components/admin/admin-users-client";

export default async function AdminUsersPage() {
  const users = await getAdminUsers();

  return <AdminUsersClient initialUsers={users} />;
}
