import { NextRequest, NextResponse } from "next/server";
import { reconcilePublicOrderStatusByInternalOrderId } from "@/lib/scalev/reconcile";
import {
  getOrderStatusCookieName,
  resolveActiveOrderStatusSession,
} from "@/lib/payment/order-status-sessions";

interface PublicStatusRequest {
  orderId?: string;
  statusSessionId?: string;
}

const PRIVATE_NO_STORE_HEADERS = {
  "Cache-Control": "private, no-store",
};
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as PublicStatusRequest | null;
  const orderId = body?.orderId;
  const statusSessionId = body?.statusSessionId;
  const rawToken = statusSessionId
    ? request.cookies.get(getOrderStatusCookieName(statusSessionId))?.value
    : undefined;

  if (
    !orderId ||
    !statusSessionId ||
    !UUID_PATTERN.test(statusSessionId) ||
    !rawToken
  ) {
    return NextResponse.json(
      { error: "Sesi status pembayaran diperlukan." },
      { status: 401, headers: PRIVATE_NO_STORE_HEADERS }
    );
  }

  try {
    const session = await resolveActiveOrderStatusSession({
      sessionId: statusSessionId,
      paymentOrderId: orderId,
      rawToken,
    });

    if (!session) {
      return NextResponse.json(
        { error: "Sesi status pembayaran tidak valid atau sudah kedaluwarsa." },
        { status: 401, headers: PRIVATE_NO_STORE_HEADERS }
      );
    }

    const payload = await reconcilePublicOrderStatusByInternalOrderId(
      session.orderId
    );
    if (!payload) {
      return NextResponse.json(
        { error: "Pesanan tidak ditemukan." },
        { status: 404, headers: PRIVATE_NO_STORE_HEADERS }
      );
    }

    return NextResponse.json(payload, {
      headers: PRIVATE_NO_STORE_HEADERS,
    });
  } catch {
    // Do not log request-bound session material or database filter details.
    console.error("Public order status request failed.");
    return NextResponse.json(
      { error: "Gagal memuat status pesanan." },
      { status: 500, headers: PRIVATE_NO_STORE_HEADERS }
    );
  }
}
