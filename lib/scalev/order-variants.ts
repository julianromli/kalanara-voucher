import type { ScalevOrderVariantLine } from "@/lib/scalev/types";

export function groupScalevOrderVariants(
  lines: readonly ScalevOrderVariantLine[]
): ScalevOrderVariantLine[] {
  const grouped: ScalevOrderVariantLine[] = [];
  const indexByVariantId = new Map<string, number>();

  for (const line of lines) {
    const existingIndex = indexByVariantId.get(line.variant_unique_id);
    if (existingIndex === undefined) {
      indexByVariantId.set(line.variant_unique_id, grouped.length);
      grouped.push({
        variant_unique_id: line.variant_unique_id,
        quantity: line.quantity,
      });
      continue;
    }

    const existing = grouped[existingIndex];
    grouped[existingIndex] = {
      variant_unique_id: existing.variant_unique_id,
      quantity: existing.quantity + line.quantity,
    };
  }

  return grouped;
}
