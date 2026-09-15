import "server-only";

import { revalidatePath, revalidateTag } from "next/cache";
import { PUBLIC_SERVICES_CACHE_TAG } from "@/lib/cache-tags";

export function revalidateServiceCatalogData() {
  revalidateTag("dashboard-stats", "max");
  revalidateTag(PUBLIC_SERVICES_CACHE_TAG, "max");
  revalidatePath("/", "page");
  revalidatePath("/admin/services", "page");
  revalidatePath("/checkout/[id]", "page");
  revalidatePath("/voucher/[id]", "page");
}
