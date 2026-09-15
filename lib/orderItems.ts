interface SortableOrderItem {
  id: string;
  sort_order: number;
  created_at: string;
}

function compareCodeUnits(left: string, right: string): number {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

export function sortOrderItems<Item extends SortableOrderItem>(
  orderItems: readonly Item[]
): Item[] {
  return [...orderItems].sort(
    (left, right) =>
      left.sort_order - right.sort_order ||
      compareCodeUnits(left.created_at, right.created_at) ||
      compareCodeUnits(left.id, right.id)
  );
}
