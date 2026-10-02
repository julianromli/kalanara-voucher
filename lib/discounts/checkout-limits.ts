export const SCALEV_MIN_PAYABLE_AMOUNT = 10_000;

export function isComplimentaryCheckoutTotal(totalAmount: number) {
  return totalAmount === 0;
}

export function isSupportedCheckoutTotal(totalAmount: number) {
  return (
    isComplimentaryCheckoutTotal(totalAmount) ||
    totalAmount >= SCALEV_MIN_PAYABLE_AMOUNT
  );
}

export const DISCOUNT_PAYABLE_AMOUNT_MESSAGE =
  "Sisa pembayaran harus Rp 0 atau minimal Rp 10.000. Ubah kode diskon, lalu coba lagi.";
