import { AdminTablePageSkeleton } from "@/components/admin/admin-skeletons";

export default function AdminPurchasesLoading() {
  return (
    <AdminTablePageSkeleton
      columns={9}
      rows={6}
      showIntroAction
      label="Memuat pembelian"
      name="purchases"
    />
  );
}
