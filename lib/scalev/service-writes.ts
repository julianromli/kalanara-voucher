import "server-only";

import { revalidatePath, revalidateTag } from "next/cache";
import { getAdminClient } from "@/lib/supabase/admin";
import type { Service, ServiceUpdate } from "@/lib/database.types";

export async function updateServiceScalevMapping(
  id: string,
  updates: Pick<
    ServiceUpdate,
    | "scalev_product_id"
    | "scalev_variant_id"
    | "scalev_variant_unique_id"
    | "scalev_sync_status"
    | "scalev_last_synced_at"
  >
): Promise<Service | null> {
  const supabase = getAdminClient();
  const { data, error } = await supabase
    .from("services")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error("Error updating service Scalev mapping:", error);
    return null;
  }

  revalidateTag("dashboard-stats", "max");
  revalidatePath("/", "page");
  revalidatePath("/admin/services", "page");
  revalidatePath("/checkout/[id]", "page");
  revalidatePath("/voucher/[id]", "page");
  return data;
}
