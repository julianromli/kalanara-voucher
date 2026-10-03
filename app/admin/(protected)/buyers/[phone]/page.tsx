import { notFound } from "next/navigation";
import { BuyerDetailClient } from "@/components/admin/buyer-detail-client";
import { getBuyerOrders } from "@/lib/actions/buyers";
import { normalizeBuyerPhone } from "@/lib/admin/buyer-phone";
import { requireAdminRouteAccess } from "@/lib/auth/admin-rbac-server";
import type { AdminBuyer } from "@/lib/actions/buyers";

interface BuyerDetailPageProps {
  params: Promise<{ phone: string }>;
}

export default async function BuyerDetailPage({ params }: BuyerDetailPageProps) {
  await requireAdminRouteAccess("/admin/buyers");
  const { phone } = await params;
  const normalized = normalizeBuyerPhone(decodeURIComponent(phone));
  const orders = normalized ? await getBuyerOrders(normalized) : [];

  if (!normalized || orders.length === 0) {
    notFound();
  }

  const names = [...new Set(orders.map((order) => order.customer_name.trim()))];
  const latest = orders[0];
  const voucherCount = new Set(
    orders.flatMap((order) => [
      order.vouchers?.id,
      ...order.order_items.map((item) => item.voucher_id),
    ].filter((id): id is string => Boolean(id))),
  ).size;

  const buyer: AdminBuyer = {
    phone: normalized,
    customerName: latest.customer_name,
    customerEmail: latest.customer_email,
    orderCount: orders.length,
    voucherCount,
    lastOrderAt: latest.created_at,
    otherNames: names.filter((name) => name !== latest.customer_name),
  };

  return <BuyerDetailClient buyer={buyer} orders={orders} />;
}
