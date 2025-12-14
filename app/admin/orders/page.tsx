import { getOrders } from "@/lib/actions/orders";
import { OrdersClient } from "@/components/admin/orders-client";

export default async function AdminOrdersPage() {
  const orders = await getOrders();

  return <OrdersClient initialOrders={orders} />;
}
