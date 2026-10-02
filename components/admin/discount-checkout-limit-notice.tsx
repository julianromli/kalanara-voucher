import { formatCurrency } from "@/lib/constants";
import { SCALEV_MIN_PAYABLE_AMOUNT } from "@/lib/discounts/checkout-limits";

export function DiscountCheckoutLimitNotice() {
  const minimumPayable = formatCurrency(SCALEV_MIN_PAYABLE_AMOUNT);
  const highestRejected = formatCurrency(SCALEV_MIN_PAYABLE_AMOUNT - 1);

  return (
    <div className="rounded-xl border border-border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
      <p className="font-medium text-foreground">Batas sisa pembayaran</p>
      <p className="mt-1">
        Scalev menerima sisa bayar Rp 0 atau minimal {minimumPayable}. Total Rp 0
        menjadi pesanan gratis dan voucher langsung terbit. Sisa dari Rp 1 sampai{" "}
        {highestRejected} ditolak.
      </p>
    </div>
  );
}
