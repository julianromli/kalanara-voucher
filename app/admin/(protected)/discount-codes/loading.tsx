import { AdminTablePageSkeleton } from "@/components/admin/admin-skeletons";

export default function AdminDiscountCodesLoading() {
  return (
    <AdminTablePageSkeleton
      columns={7}
      rows={5}
      showIntroAction
      filtersOutside
      label="Memuat kode promo"
      name="discount-codes"
    />
  );
}
