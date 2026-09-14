import "server-only";

import { revalidatePath, revalidateTag } from "next/cache";

export function revalidateServiceCatalogData() {
  revalidateTag("dashboard-stats", "max");
  revalidatePath("/", "page");
  revalidatePath("/admin/services", "page");
  revalidatePath("/checkout/[id]", "page");
  revalidatePath("/voucher/[id]", "page");
}
