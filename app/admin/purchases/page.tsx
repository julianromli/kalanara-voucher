import { getOrders } from "@/lib/actions/orders";
import { PurchasesClient } from "@/components/admin/purchases-client";

export default async function AdminPurchasesPage() {
  const orders = await getOrders();

  return <PurchasesClient initialOrders={orders} />;
}
