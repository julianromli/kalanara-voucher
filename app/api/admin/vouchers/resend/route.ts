import { NextRequest, NextResponse } from "next/server";
import { isAdminPermissionError } from "@/lib/auth/admin-rbac-server";
import { resendVoucherEmailForAdmin } from "@/lib/voucher-resend/server";

// Admin-only voucher email resend. It lives in a route handler, not a server
// action, so the voucher PDF assets are traced into this function.
export async function POST(request: NextRequest) {
  // A JSON content type forces a CORS preflight, so a cross-site form post
  // cannot reach the resend with the admin's cookies.
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) {
    return NextResponse.json({ status: "invalid" }, { status: 415 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ status: "invalid" }, { status: 400 });
  }

  const input = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  try {
    const result = await resendVoucherEmailForAdmin({
      orderId: typeof input.orderId === "string" ? input.orderId : "",
      voucherId: typeof input.voucherId === "string" ? input.voucherId : "",
      target: input.target as "RECIPIENT" | "BUYER" | "CUSTOM",
      email: typeof input.email === "string" ? input.email : undefined,
      saveAsRecipient: input.saveAsRecipient === true,
    });
    return NextResponse.json(result);
  } catch (error) {
    if (isAdminPermissionError(error)) {
      return NextResponse.json({ status: "forbidden" }, { status: error.status });
    }
    console.error("[VoucherResend] Unexpected error:", error);
    return NextResponse.json({ status: "error" }, { status: 500 });
  }
}
