import { NextRequest, NextResponse } from "next/server";
import { reconcilePublicOrderStatus } from "@/lib/scalev/reconcile";

export async function GET(request: NextRequest) {
  const orderId = request.nextUrl.searchParams.get("order_id");
  const token = request.nextUrl.searchParams.get("token");

  if (!orderId || !token) {
    return NextResponse.json(
      { error: "order_id and token are required" },
      { status: 400 }
    );
  }

  const payload = await reconcilePublicOrderStatus(orderId, token);
  if (!payload) {
    return NextResponse.json(
      { error: "Order tidak ditemukan" },
      { status: 404 }
    );
  }

  return NextResponse.json(payload);
}
