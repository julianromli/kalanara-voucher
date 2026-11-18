import QRCode from "qrcode";
import { NextResponse } from "next/server";
import { AdminPermission } from "@/lib/auth/admin-rbac";
import {
  isAdminPermissionError,
  requireAdminPermission,
} from "@/lib/auth/admin-rbac-server";
import { signupPageUrl } from "@/lib/membership/urls";
import { getAdminClient } from "@/lib/supabase/admin";

export async function GET() {
  try {
    await requireAdminPermission(AdminPermission.MEMBERS_SETTINGS);
    const supabase = getAdminClient();
    const { data, error } = await supabase
      .from("member_signup_qr")
      .select("token")
      .is("revoked_at", null)
      .maybeSingle();
    if (error) {
      return new NextResponse("QR gagal dimuat", { status: 500 });
    }
    if (!data) {
      return new NextResponse("QR tidak ditemukan", { status: 404 });
    }

    const png = await QRCode.toBuffer(signupPageUrl(data.token), {
      type: "png",
      width: 1024,
      margin: 1,
    });

    return new NextResponse(new Uint8Array(png), {
      headers: {
        "Content-Type": "image/png",
        "Content-Disposition": 'attachment; filename="kalanara-daftar-member.png"',
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    if (isAdminPermissionError(error)) {
      return new NextResponse(error.status === 401 ? "Unauthorized" : "Forbidden", {
        status: error.status,
      });
    }
    return new NextResponse("QR gagal dibuat", { status: 500 });
  }
}
