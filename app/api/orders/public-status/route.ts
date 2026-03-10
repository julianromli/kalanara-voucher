import { NextRequest, NextResponse } from "next/server";
import { reconcilePublicOrderStatus } from "@/lib/scalev/reconcile";

interface PublicStatusRequest {
  orderId?: string;
  token?: string;
}

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as PublicStatusRequest | null;
  const orderId = body?.orderId;
  const token = body?.token;

  if (!orderId || !token) {
    return NextResponse.json(
      { error: "orderId and token are required" },
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
