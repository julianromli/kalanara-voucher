import { AdminTablePageSkeleton } from "@/components/admin/admin-skeletons";

export default function AdminVouchersLoading() {
  return (
    <AdminTablePageSkeleton
      columns={7}
      rows={6}
      showStats
      label="Memuat voucher"
    />
  );
}
