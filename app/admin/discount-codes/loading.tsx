import { AdminTablePageSkeleton } from "@/components/admin/admin-skeletons";

export default function AdminDiscountCodesLoading() {
  return (
    <AdminTablePageSkeleton
      columns={7}
      rows={5}
      showIntroAction
      label="Memuat kode promo"
    />
  );
}
