import { NextRequest, NextResponse } from "next/server";
import { createScalevCheckout } from "@/lib/payment/checkout-service";
import {
  getOrderStatusCookieName,
  ORDER_STATUS_SESSION_TTL_SECONDS,
  scheduleExpiredOrderStatusSessionCleanup,
} from "@/lib/payment/order-status-sessions";
import type { ScalevCreatePaymentResponse } from "@/lib/scalev/types";

export async function POST(
  request: NextRequest
): Promise<NextResponse<ScalevCreatePaymentResponse>> {
  const body = await request.json().catch(() => null);
  const result = await createScalevCheckout(body);

  if (!result.success) {
    return NextResponse.json(result.body, { status: result.status });
  }

  const response = NextResponse.json(result.body, {
    headers: { "Cache-Control": "private, no-store" },
  });
  response.cookies.set(
    getOrderStatusCookieName(result.statusSession.id),
    result.statusSession.rawToken,
    {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/",
      maxAge: ORDER_STATUS_SESSION_TTL_SECONDS,
    }
  );
  scheduleExpiredOrderStatusSessionCleanup();

  return response;
}
