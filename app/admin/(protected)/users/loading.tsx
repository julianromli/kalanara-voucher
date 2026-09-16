import { AdminTablePageSkeleton } from "@/components/admin/admin-skeletons";

export default function AdminUsersLoading() {
  return (
    <AdminTablePageSkeleton
      columns={5}
      rows={5}
      showIntroAction
      label="Memuat pengguna"
      name="users"
    />
  );
}
