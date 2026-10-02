export function voucherFaceValue(item: {
  original_unit_price: number;
  unit_price: number;
}) {
  if (item.unit_price === 0 && item.original_unit_price > 0) {
    return item.original_unit_price;
  }

  return item.unit_price;
}
