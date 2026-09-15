interface SortableOrderItem {
  id: string;
  sort_order: number;
  created_at: string;
}

export function sortOrderItems<Item extends SortableOrderItem>(
  orderItems: readonly Item[]
): Item[] {
  return [...orderItems].sort(
    (left, right) =>
      left.sort_order - right.sort_order ||
      left.created_at.localeCompare(right.created_at) ||
      left.id.localeCompare(right.id)
  );
}
